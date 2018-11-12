var state = {
    savedDesktops: {},
    enabled: true
};

const ignoreList = ["plasmashell", "lattedock", "krunner", "kcmshell5"];

function log(msg, client, indent) {
    var suffix = "";
    var prefix = "Auto-Desktop: ";
    if (client) {
        suffix += " - " + client.caption;
    } 
    if (indent) {
        prefix += "\t";
    }
    print(prefix + msg + suffix);
}

//checks if the given client should be ignored
function ignoreClient(client) {
    if (client.normalWindow && ignoreList.indexOf(client.resourceClass.toString()) == -1) {
        return false;
    }
    log("Ignoring client", client, true)
    return true;
}

//counts the number of client on given desktop
function clientsOnDesktop(desktop, onlyMaximized){
    var sum = Infinity;
    if(desktop > 1 && workspace.desktops >= desktop) {
        const clients = workspace.clientList();
        sum = 0;
        for (var i = 0; i < clients.length; i++) {
            if(clients[i].desktop == desktop && !ignoreClient(clients[i]) 
            && (!onlyMaximized || state.savedDesktops[clients[i].windowId])) {
                sum++;
            }
        }
    } 
    return sum;
}

//shifts the desktop either forward or backward
function shiftDesktops(boundary, reverse) {
    const clients = workspace.clientList();
    var direction = -1; 
    
    if (!reverse){
        direction = 1;
        workspace.desktops += 1;
    }
    
    for (var i= 0; i < clients.length; i++) {
        if (clients[i].isCurrentTab && clients[i].desktop >= boundary) {
            clients[i].desktop += direction;
        }
    }
    
    if (reverse && workspace.desktops > 1) {
        workspace.desktops -= 1;
    }
}


function updateSavedDesktops(boundary, value) {
    log("Updating savedDesktops");
    for(var client in state.savedDesktops){
        if (state.savedDesktops[client].desktop >= boundary) {
            state.savedDesktops[client].desktop += value;
            log("Updating savedDesktop to " + state.savedDesktops[client].desktop, workspace.getClient(client), true);
        }
    }
}

function moveToNextDesktop(client) {
    log("Moving window to new desktop", client, true)
    if (clientsOnDesktop(client.desktop +1, false) > 0) {
        shiftDesktops(client.desktop + 1, false);
        updateSavedDesktops(workspace.currentDesktop, 1);
    }
    client.desktop += 1;
    workspace.currentDesktop += 1;
    workspace.activeClient = client;
}

function moveBack(client, desktop, deleted) {
    log("Resotring client to desktop " + desktop, client, true);
    delete state.savedDesktops[client.windowId];
    const current = workspace.currentDesktop;
    if (clientsOnDesktop(current, false) <= 1) {
        shiftDesktops(current + 1, true);
        updateSavedDesktops(current, -1);
    }
    if (deleted) {
        workspace.currentDesktop = desktop;
    } else {
        client.desktop = desktop;
        workspace.currentDesktop = desktop;
        workspace.activeClient = client;
    }
}

function fullHandler(client, full, user) {
    log("\nuser:" + user)
    log("Fullscreen toggled", client)
    if (ignoreClient(client)) {
        return;
    }
    if (full) {
        if (state.savedDesktops[client.windowId]) {
            state.savedDesktops[client.windowId].maximizedAndFullscreen = true;
        } 
        else if (clientsOnDesktop(client.desktop, false) > 1) {
            state.savedDesktops[client.windowId] = {
                desktop: client.desktop,
                maximizedAndFullscreen: false
            };
            moveToNextDesktop(client);
    }
    } else {
        var saved = state.savedDesktops[client.windowId];
        if (saved === undefined) {
            log("Ignoring client not previously seen", client, true);
        } else {
            if (saved.maximizedAndFullscreen) {
                saved.maximizedAndFullscreen = false;
            } else {
                moveBack(client, saved.desktop);
            }
        }
    }
}

function addHandler(client) {
    if (ignoreClient(client)) {
        return;
    }
    if (clientsOnDesktop(workspace.currentDesktop, true) > 0) {
        log("Client added, moving to desktop 1", client)
        client.desktop = 1;
        workspace.currentDesktop = 1;
        workspace.activeClient = client;
    }
}


function rmHandler(client) {
    log("Client removed", client)
    if (ignoreClient(client)) {
        return;
    }
    moveBack(client, 1, true);
}

function install() {
    workspace.clientMaximizeSet.connect(fullHandler);
    workspace.clientFullScreenSet.connect(fullHandler);
    workspace.clientRemoved.connect(rmHandler);
    workspace.clientAdded.connect(addHandler);
    workspace.desktops = 1;
    log("Handler installed");
}

function uninstall() {
    workspace.clientFullScreenSet.disconnect(handler);
    workspace.clientMaximizeSet.disconnect(fullHandler);
    workspace.clientRemoved.disconnect(rmHandler);
    workspace.clientAdded.disconnect(addHandler);
    log("Handler cleared");
}

registerUserActionsMenu(function(client){
    return {
        text: "Maximize to New Desktop",
        items: [
            {
                text: "Enabled",
                checkable: true,
                checked: state.enabled,
                triggered: function() {
                    state.enabled = !state.enabled;
                    if (state.enabled) {
                        install();
                    } else {
                        uninstall();
                    }
                }
            },
        ]
    };
});

install();
