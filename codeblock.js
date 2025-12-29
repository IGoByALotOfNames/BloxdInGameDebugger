rawCode = `
// Helper function to manage party rewards
function distributePartyRewards(pid) {
    var partyData = api.getPlayerPartyWhenJoined(pid);
    if (partyData && partyData.playerDbIds && partyData.playerDbIds.length > 0) {
        var currentShield = api.getShieldAmount(pid);
        if (currentShield < 50) {
            api.setShieldAmount(pid, 100);
            api.showShopTutorial(pid); 
        }
    }
}

var allPlayers = api.getPlayerIds();
var safeBlock = "Code Block";
var dangerBlock = "Grass Block";
var damageAmount = -15;
var teleportSafeSpot = [0, 100, 0];

for (var i = 0; i < allPlayers.length; i++) {
    var currentPlayer = allPlayers[i];
    if (api.playerIsInGame(currentPlayer)) {
        var blocksStanding = api.getBlockTypesPlayerStandingOn(currentPlayer);
        var isInSafeZone = false;
        var isInDanger = false;

        for (var b = 0; b < blocksStanding.length; b++) {
            if (blocksStanding[b] === safeBlock) {
                isInSafeZone = true;
            } else if (blocksStanding[b] === dangerBlock) {
                isInDanger = true;
            }
        }
        if (isInSafeZone) {
            distributePartyRewards(currentPlayer);
            var currentHp = api.getHealth(currentPlayer);
            if (currentHp < 100) {
                api.setHealth(currentPlayer, 100, null, true);
            }
        } else if (isInDanger) {
            if (api.playerIsLogedIn(currentPlayer)) {
                var wasKilled = api.applyHealthChange(currentPlayer, damageAmount, null, true);
                if (wasKilled) {
                    console.log("Player died to lava");
                } else {
                    var newHp = api.getHealth(currentPlayer);
                    if (newHp < 20) {
                        api.setPosition(currentPlayer, teleportSafeSpot);
                    }
                }
            }
        } else {
            var coords = api.getBlockCoordinatesPlayerStandingOn(currentPlayer);
            if (coords.length === 0) {
                console.log("Player is jumping");
            }
        }
    }
}

`;
""
