var state = {
    savedDesktops: {},
    enabled: true
};

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

function ignore(client) {
    const ignoreList = ["plasmashell", "lattedock", "krunner"];
    if (client.normalWindow) {
        for (var i in ignoreList) {
            if (ignoreList[i] == client.resourceClass) {
                log("Ignoring client", client)
                return true;
            }
        }
    }
    return false;
}

function clientsOnDesktop(desktop, onlyMaximized){
    var sum = Infinity;
    if(desktop > 1 && workspace.desktops >= desktop) {
        const clients = workspace.clientList();
        sum = 0;
        for (var i = 0; i < clients.length; i++) {
            if(clients[i].desktop == desktop && !ignore(clients[i]) 
            && (!onlyMaximized || state.savedDesktops[clients[i].windowId])) {
                sum++;
            }
        }
    }
    
    return sum;
}

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
            log("Updating savedDesktop to " + state.savedDesktops[client].desktop, workspace.getClient(client));
        }
    }
}

function moveToNewDesktop(client) {
    log("Moving window to new desktop", client, true)
    if (clientsOnDesktop(client.desktop +1, false) > 0) {
        shiftDesktops(client.desktop + 1, false);
    }
    client.desktop += 1;
    workspace.currentDesktop += 1;
    workspace.activeClient = client;
    updateSavedDesktops(workspace.currentDesktop, 1);
}

function moveBack(client, desktop, deleted) {
    delete state.savedDesktops[client.windowId];
    const current = client.desktop;
    if (clientsOnDesktop(current, false) <= 1) {
        shiftDesktops(current + 1, true);
    }
    updateSavedDesktops(current, -1);
    if (deleted) {
        workspace.currentDesktop = 1;
    } else {
        client.desktop = desktop;
        workspace.currentDesktop = desktop;
        workspace.activeClient = client;
    }
}

function fullHandler(client, full, user) {
    if (ignore(client)) {
        return;
    }
    log("Fullscreen toggled", client)
    if (full) {
        if (state.savedDesktops[client.windowId]) {
            state.savedDesktops[client.windowId].maximizedAndFullscreen = true;
        } 
        else if (clientsOnDesktop(client.desktop, false) > 1) {
            state.savedDesktops[client.windowId] = {
                desktop: client.desktop,
                maximizedAndFullscreen: false
            };
            moveToNewDesktop(client);
    }
    } else {
        var saved = state.savedDesktops[client.windowId];
        if (saved === undefined) {
            log("Ignoring client not previously seen", client, true);
        } else {
            if (saved.maximizedAndFullscreen) {
                saved.maximizedAndFullscreen = false;
            } else {
                log("Resotring client to desktop " + saved.desktop, client, true);
                moveBack(client, saved.desktop);
            }
        }
    }
}

function addHandler(client) {
    if (ignore(client)) {
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
    if (ignore(client)) {
        return;
    }

    moveBack(client, true);
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
