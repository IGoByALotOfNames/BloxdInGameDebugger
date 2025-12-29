# BloxdInGameDebugger

Bloxd In-Game Debugger (Codenamed Stardue Debugger) is designed to allow users to debug their code easily and to find bugs more easily in bloxd.io

## Usage

As described in this [Youtube Video](https://youtu.be/jKbtv7DhAsQ).

Copy worldcode_mini.js to world code.

To use the example, copy codeblock.js to a code block and run the code block.

## FILES

### worldcode_og.js

This is the original code written by Chestplate and Gemini 3 Pro Preview

### worldcode_mini.js

This is a mangled + minified code translated from worldcode_og.js via the model Gemini 2.5 Pro (I ran out of credits on Gemini 3 Pro Preview). Use this in actuall production since it takes up less characters.

# HOW DOE IT WORK?

## ⚙️ Core Concepts & Mechanics

This debugger solves two major problems in game scripting: **Memory Limits** and **Execution Timeouts**.

### 1. How it "Records" Variables (The Scope Trick)
The debugger **does not** actually record variables while the code is running. If it tried to save a copy of every variable at every line, the game would run out of memory immediately.

Instead, it uses a **"Peek on Demand"** strategy using `eval()` inside a closure.

**Instrumented Code (What runs internally):**
```javascript
var health = 100;
// We inject this BEFORE the line executes:
yield { 
    line: 1, 
    scope: function(varName) { return eval(varName); } 
};
```
*   The `yield` pauses execution.
*   The `scope` function is defined **inside** the execution context. Therefore, it has access to `health`, `api`, and local variables.
*   When you type `/info`, the debugger calls `currentLineInfo.scope("health")`.
*   The `eval("health")` runs **inside that frozen moment** and returns `100`.

### 2. How it Handles Types
Since `eval()` returns raw JavaScript values, the debugger handles display logic based on `typeof` to prevent crashing the API with massive objects.

| Type | Handling Logic | Output Example |
| :--- | :--- | :--- |
| **Number** | Converted to string. | `s: 2` |
| **String** | Wrapped in quotes. | `name: "Player1"` |
| **Object** | `JSON.stringify` (Truncated to 40 chars). | `stats: {"hp":10...` |
| **Function** | **Special Case:** Returns placeholder to prevent dumping code. | `myFunc: [Function]` |

### 3. How it Handles Functions (`yield*`)
Standard functions (`function`) cannot pause execution. The debugger rewrites your code using **Generators**:

1.  **Definitions:** `function wsg() { ... }` $\to$ `function* wsg() { ... }`
2.  **Calls:** `wsg()` $\to$ `yield* wsg()`

**`yield*`** is the secret sauce. It tells the parent generator to "absorb" the steps of the child generator. This allows **"Step Into"** functionality.

### 4. How it Handles Loops
Loops are handled naturally. The debugger injects a `yield` inside the loop body.
1.  Loop starts $\to$ Hits `yield` $\to$ **PAUSE**.
2.  User steps $\to$ Code runs `i++` and checks condition.
3.  Loop restarts $\to$ Hits `yield` again $\to$ **PAUSE**.

---

## 🔍 Class Structure Breakdown

### 1. Setup & State Machine
```javascript
var dbg = null; // Global Singleton
class JSDebugger { ... }
```
*   **`linesPerTick = 20`**: Processes code in chunks of 20 lines per game frame. This prevents "Script execution timed out" errors.
*   **`status`**: Controls the lifecycle (`ANALYZING` → `INSTRUMENTING` → `COMPILING` → `READY`).

### 2. The Async Loop (`update`)
Called every tick (20ms). It manages the workload to ensure the game never freezes while the debugger is initializing.

### 3. Phase 1: Analysis (`performAnalysisPhase`)
*   **`extractFunctionNames`**: Finds user functions so we can convert them to Generators.
*   **`extractVariableNames`**: Scans for variables (`i`, `s`, `player`) while ignoring keywords and dangerous global objects (`api`, `console`).

### 4. Phase 2: Instrumentation (`performInstrumentationPhase`)
This is the heavy lifter.
*   **Brace Counting**: It tracks `{` and `}` to calculate **Depth** (used for "Step Over").
*   **Rewriting**: Converts `function` to `function*` and calls to `yield*`.
*   **Injection**: Inserts the `yield { l: lineNo, scope: ... }` packet before every line.

### 5. Phase 3: Compilation (`performCompilationPhase`)
Uses the `GeneratorFunction` constructor to compile the instrumented string back into executable JavaScript and instantiates the iterator.

### 6. Execution Control
*   **`step()` (Step Into)**: Calls `generator.next()`. Moves one instruction forward, entering functions if necessary.
*   **`stepOver()`**:
    1.  Records current **Depth**.
    2.  Loops `generator.next()` repeatedly until the Depth returns to the starting level (skipping over the function body).

### 7. Smart Info Logic (`info`)
*   **IF Detection**: It reads the raw code line. If it sees `if (x == y)`, it extracts `x` and `y`, evaluates them in the current scope, and prints `[IF CHECK] "Grass" == "Dirt": false`.
*   **Variable Dump**: Iterates the list of known variables and evaluates them using the closure scope.
