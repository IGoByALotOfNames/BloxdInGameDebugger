// Global variable
var dbg = null;

class JSDebugger {
    constructor(codeSnippet, playerId) {
        this.playerId = playerId;
        this.originalCode = codeSnippet;
        
        if (typeof codeSnippet !== 'string') {
            this.lines = [];
        } else {
            this.lines = codeSnippet.split('\n');
        }
        
        this.outputTarget = "crosshairText"; 
        this.linesPerTick = 20;

        this.status = "ANALYZING"; 
        this.instrumentationIndex = 0;
        this.instrumentedCodeBuilder = "";
        
        this.variableNames = [];
        this.userFunctions = [];
        this.braceDepth = 0; 
        
        this.debugGenerator = null;
        this.currentLineInfo = null;
        this.isComplete = false;
        this.isError = false;
        this.errorMsg = "";

        this.showLoadingUI("Initializing...");
    }

    update() {
        if (this.status === "READY" || this.status === "ERROR") return;

        try {
            if (this.status === "ANALYZING") this.performAnalysisPhase();
            else if (this.status === "INSTRUMENTING") this.performInstrumentationPhase();
            else if (this.status === "COMPILING") this.performCompilationPhase();
        } catch (e) {
            console.log("Debugger Crash: " + e);
            this.handleCriticalError("Init Error: " + e.message);
        }
    }

    handleCriticalError(msg) {
        this.isError = true;
        this.errorMsg = msg;
        this.status = "ERROR";
        this.renderCodeOverlay();
    }

    performAnalysisPhase() {
        this.userFunctions = this.extractFunctionNames(this.originalCode);
        this.variableNames = this.extractVariableNames(this.originalCode);
        this.status = "INSTRUMENTING";
        this.instrumentationIndex = 0;
        this.instrumentedCodeBuilder = "";
        this.braceDepth = 0;
        this.showLoadingUI("Analyzing...");
    }

    performInstrumentationPhase() {
        let count = 0;
        while (count < this.linesPerTick && this.instrumentationIndex < this.lines.length) {
            const line = this.lines[this.instrumentationIndex];
            if (typeof line === 'string') this.processSingleLine(line, this.instrumentationIndex);
            this.instrumentationIndex++;
            count++;
        }

        if (this.instrumentationIndex >= this.lines.length) {
            this.status = "COMPILING";
            this.showLoadingUI("Compiling...");
        } else {
            let pct = Math.floor((this.instrumentationIndex / this.lines.length) * 100);
            this.showLoadingUI(`Instrumenting... ${pct}%`);
        }
    }

    processSingleLine(line, index) {
        let processedLine = line;
        const lineNo = index + 1;

        let cleanCode = "";
        try {
            cleanCode = line.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "") 
                            .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
        } catch (e) { cleanCode = ""; }

        const openBraces = (cleanCode.match(/\{/g) || []).length;
        const closeBraces = (cleanCode.match(/\}/g) || []).length;
        
        if (this.userFunctions && this.userFunctions.length > 0) {
            this.userFunctions.forEach(funcName => {
                try {
                    const defRegex = new RegExp(`function\\s+${funcName}\\b`);
                    if (defRegex.test(processedLine)) processedLine = processedLine.replace(defRegex, `function* ${funcName}`);
                    if (!processedLine.includes(`function* ${funcName}`)) {
                        const callRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
                        processedLine = processedLine.replace(callRegex, `yield* ${funcName}(`);
                    }
                } catch(e) {}
            });
        }

        const traceObj = `{ l:${lineNo}, d:${this.braceDepth}, scope:function(s){try{return eval(s)}catch(e){return undefined}} }`;
        this.instrumentedCodeBuilder += `yield ${traceObj};\n${processedLine}\n`;
        this.braceDepth += openBraces - closeBraces;
    }

    performCompilationPhase() {
        try {
            const GeneratorFunction = Object.getPrototypeOf(function*() {}).constructor;
            this.debugGenerator = new GeneratorFunction(this.instrumentedCodeBuilder)();
            this.status = "READY";
            this.start();
        } catch (e) {
            throw new Error("Syntax Error/OOM: " + e.message);
        }
    }

    start() {
        this.advance(); 
        const breakLine = this.lines.findIndex(l => l.includes("//BREAK")) + 1;
        if (breakLine > 0) {
            let safety = 0;
            while (!this.isComplete && !this.isError && this.currentLineInfo.l < breakLine && safety < 2000) {
                this.advance();
                safety++;
            }
        }
        this.updateView();
    }

    advance() {
        if (this.isComplete || this.isError) return;
        try {
            const result = this.debugGenerator.next();
            if (result.done) {
                this.isComplete = true;
                this.currentLineInfo = null;
            } else {
                this.currentLineInfo = result.value;
            }
        } catch (e) {
            this.isError = true;
            let msg = String(e); 
            if (msg.length > 60) msg = msg.substring(0, 60) + "...";
            this.errorMsg = msg;
            this.updateView();
        }
    }

    step() { if (this.status === "READY") this.stepInto(); }
    
    stepInto() {
        if (this.isComplete || this.isError) return;
        this.advance();
        this.updateView();
    }

    stepOver() {
        if (this.status !== "READY" || this.isComplete || this.isError) return;
        const startDepth = this.currentLineInfo ? this.currentLineInfo.d : 0;
        this.advance();
        let safety = 0;
        while (!this.isComplete && !this.isError && this.currentLineInfo && this.currentLineInfo.d > startDepth && safety < 1000) {
            this.advance();
            safety++;
        }
        this.updateView();
    }

    updateView() { this.renderCodeOverlay(); }

    renderCodeOverlay() {
        if (!this.lines || this.lines.length === 0) return;
        
        const VIEW_SIZE = 20;
        const HALF_VIEW = 10;
        let currentLine = 1;
        
        if (this.currentLineInfo) currentLine = this.currentLineInfo.l;
        else if (this.isComplete) currentLine = this.lines.length;

        let startIdx = 0;
        if (this.lines.length > VIEW_SIZE) {
            startIdx = currentLine - HALF_VIEW;
            if (startIdx < 0) startIdx = 0;
            if (startIdx + VIEW_SIZE > this.lines.length) startIdx = this.lines.length - VIEW_SIZE;
        }
        const endIdx = Math.min(startIdx + VIEW_SIZE, this.lines.length);

        let beforeText = "", currentText = "", afterText = "";

        for (let i = startIdx; i < endIdx; i++) {
            const lineNum = i + 1;
            const isTarget = (lineNum === currentLine && !this.isComplete);
            
            let marker = "|";
            if (isTarget) marker = this.isError ? "✖" : "▷";
            
            const numStr = lineNum.toString().padStart(3, " "); 
            const formattedLine = `${numStr} ${marker}  ${this.lines[i]}\n`;

            if (lineNum < currentLine) beforeText += formattedLine;
            else if (isTarget) {
                currentText += formattedLine;
                if (this.isError) currentText += `    ↳ [ERR] ${this.errorMsg}\n`;
            }
            else afterText += formattedLine;
        }

        const payload = [];
        if (beforeText) payload.push({ str: beforeText, style: { color: "#AAAAAA", opacity: 0.8 } });
        if (currentText) {
             const col = this.isError ? "#FF5555" : "#FFFF55";
             payload.push({ str: currentText, style: { color: col, fontWeight: "bold" } });
        }
        if (this.isComplete) payload.push({ str: "\n-- FINISHED --\n", style: { color: "#00FF00" } });
        if (afterText) payload.push({ str: afterText, style: { color: "#AAAAAA", opacity: 0.8 } });

        if (typeof api !== 'undefined' && typeof api.setClientOption === 'function') {
            api.setClientOption(this.playerId, this.outputTarget, payload);
        }
    }

    // --- INFO METHOD WITH SMART IF-CHECKING ---
    info() {
        if (this.status !== "READY" || !this.currentLineInfo || this.isComplete) return;
        
        try {
            let accumulatedStr = "";

            // 1. EXTRACT LINE
            const rawLine = this.lines[this.currentLineInfo.l - 1].trim();
            const logicPart = rawLine.replace(/^(\}\s*)?(else\s*)?/, "").trim();

            // 2. DETECT "IF"
            if (logicPart.startsWith("if")) {
                const ifIndex = rawLine.indexOf("if");
                const openParenIndex = rawLine.indexOf("(", ifIndex); 
                const closeParenIndex = rawLine.lastIndexOf(")");
                
                if (ifIndex !== -1 && openParenIndex !== -1 && closeParenIndex > openParenIndex) {
                    const conditionStr = rawLine.substring(openParenIndex + 1, closeParenIndex);
                    
                    try {
                        // A. Evaluate boolean result
                        const boolResult = this.currentLineInfo.scope(conditionStr);
                        let displayCondition = "";

                        // B. Attempt to decompose Binary Operation (e.g., x === y)
                        // This regex looks for comparison operators surrounded by anything
                        // It captures: [Group 1: LHS] [Group 2: Operator] [Group 3: RHS]
                        const parts = conditionStr.split(/\s*(===|==|!==|!=|<=|>=|<|>)\s*/);

                        if (parts.length === 3) {
                            const lhs = parts[0];
                            const op = parts[1];
                            const rhs = parts[2];
                            
                            // Eval LHS
                            let lhsVal = this.currentLineInfo.scope(lhs);
                            if (typeof lhsVal === 'string') lhsVal = `"${lhsVal}"`;
                            else if (Array.isArray(lhsVal)) lhsVal = `[Array]`;
                            
                            // Eval RHS
                            let rhsVal = this.currentLineInfo.scope(rhs);
                            if (typeof rhsVal === 'string') rhsVal = `"${rhsVal}"`;
                            else if (Array.isArray(rhsVal)) rhsVal = `[Array]`;

                            displayCondition = `${lhsVal} ${op} ${rhsVal}`;
                        } 
                        else {
                            // C. Fallback for complex logic (e.g. x && y)
                            // Replace variable names with their values
                            displayCondition = conditionStr;
                            this.variableNames.forEach(v => {
                                // Regex: replace 'v' but only if it matches a whole word
                                const regex = new RegExp(`\\b${v}\\b`, 'g');
                                if (regex.test(displayCondition)) {
                                    let val = this.currentLineInfo.scope(v);
                                    if (typeof val === 'string') val = `"${val}"`;
                                    if (String(val).length < 15) { // Only swap if short
                                        displayCondition = displayCondition.replace(regex, String(val));
                                    }
                                }
                            });
                        }
                        
                        accumulatedStr += `[IF CHECK] ${displayCondition}: ${boolResult}\n----------------\n`;

                    } catch (e) {
                        accumulatedStr += `[IF CHECK] (Eval Error): error\n----------------\n`;
                    }
                }
            }

            // 3. DUMP VARIABLES (Shortened)
            this.variableNames.forEach(varName => {
                let val = undefined;
                try {
                    val = this.currentLineInfo.scope(varName);
                } catch(e) { return; }

                if (val === undefined) return;

                let displayVal = val;
                
                if (typeof val === 'function') displayVal = "[Function]";
                else if (typeof val === 'object' && val !== null) {
                    try { 
                        let s = JSON.stringify(val);
                        if (s.length > 30) displayVal = s.substring(0, 30) + "..."; 
                        else displayVal = s;
                    } catch (e) { displayVal = "[Obj]"; }
                } else {
                    let s = String(val);
                    if (s.length > 30) displayVal = s.substring(0, 30) + "...";
                    else displayVal = s;
                }
                
                accumulatedStr += `${varName}: ${displayVal}\n`;
            });

            if (!accumulatedStr) accumulatedStr = "No vars";
            
            if (typeof api !== 'undefined' && typeof api.setClientOption === 'function') {
                api.setClientOption(this.playerId, "RightInfoText", [{ str: accumulatedStr }]);
            }
        } catch (e) {
            // console.log("Info Error: " + e);
        }
    }

    showLoadingUI(text) {
        if (typeof api !== 'undefined' && typeof api.setClientOption === 'function') {
            api.setClientOption(this.playerId, this.outputTarget, [{
                str: `[DEBUGGER]\n${text}`,
                style: { color: "#FFFF00" }
            }]);
        }
    }

    extractFunctionNames(code) {
        if (!code) return [];
        const matches = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g) || [];
        return matches.map(m => m.replace(/function\s+|\s*\(/g, '').trim());
    }

    extractVariableNames(code) {
        if (!code) return [];
        const keywords = new Set(['var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'function', 'return', 'try', 'catch', 'finally', 'switch', 'case', 'default', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'from', 'void', 'typeof', 'in', 'instanceof', 'yield', 'await', 'async', 'throw', 'debugger', 'null', 'true', 'false', 'undefined', 'NaN', 'Infinity', 
        'api', 'console', 'Math', 'Object', 'Array', 'String', 'Number', 'window', 'global']);
        
        let cleanCode = "";
        try {
            cleanCode = code.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '') 
                            .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
        } catch(e) { return []; }

        const matches = cleanCode.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
        return [...new Set(matches)].filter(m => !keywords.has(m));
    }
}
function tick() {
    try {
        if (dbg) dbg.update();
    } catch (e) {}
}


function playerCommand(id,cmd){
  if (cmd==="init"){
	api.giveItem(id, "Moonstone Fragment", null, {customDisplayName: "Step"})
	api.giveItem(id, "Diamond Fragment", null, {customDisplayName: "Step Over"})
    dbg = new JSDebugger(rawCode, id);
    
    return true
  }else if (cmd==="info"){
	if (dbg) { dbg.info(); }
    return true
  }else if (cmd==="step"){
    if (dbg) { dbg.step(); dbg.info(); }
    return true
  }else if (cmd==="clear"){
	api.setClientOption(id, "crosshairText", "")
	api.setClientOption(id, "RightInfoText", "")
	
	return true
  }
}
function onPlayerAltAction(id){
	itm=api.getItemSlot(id, api.getSelectedInventorySlotI(id))
	if (itm.attributes.customDisplayName === "Step" && dbg){
		dbg.step()
		dbg.info()
	}else if (itm.attributes.customDisplayName === "Step Over" && dbg){
		dbg.stepOver()
		dbg.info()
	}
	
}
