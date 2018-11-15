var state = {
    minimized: {},
    maximized: {},
    fullscreen: {}
};

var config = {
    enabled: true,
    ignoreList: ["plasmashell", "lattedock", "krunner"]
};

function log(msg, client, subFunction) {
    var suffix = "";
    var prefix = "Auto-Desktop: ";
    if (client) {
        suffix += " - " + client.caption;
    } 
    if (subFunction) {
        prefix += "\t";
    } else {
        prefix = "\n" + prefix;
    }
    print(prefix + msg + suffix);
}

//checks if the given client should be ignored
function ignoreClient (client) {
    if (client.normalWindow && config.ignoreList.indexOf(client.resourceClass.toString()) == -1) {
        return false;
    }
    //log("Ignoring client", client, true)
    return true;
}

function removeEntries (client) {
    delete state.maximized[client.windowId];
    delete state.fullscreen[client.windowId];
}

function maximized (client) {
    return state.maximized[client.windowId] && !client.minimized;
}

function fullscreen (client) {
    return state.fullscreen[client.windowId] && !client.minimized;
}

function minimized (client) {
    return state.minimized[client.windowId];
}

function allClients (desktop) {
    return workspace.clientList().filter(function(c) {
        return (!desktop || c.desktop == desktop) && !ignoreClient(c)
    });
}

function fullscreenClients (desktop) {
    return allClients(desktop).filter(fullscreen);
}

function maximizedClients (desktop) {
    return allClients(desktop).filter(maximized);
}

function fillingClients (desktop) {
    return fullscreenClients(desktop).concat(maximizedClients(desktop));
}

function updateDesktops (start, value) {
    log("Updating savedDesktops", undefined, true);
    for (var list in Object.keys(state)) {
        for(var windowId in state[list]){
            if (state[list][windowId] >= start) {
                state[list][windowId] += value;
                log("Updating savedDesktop to " + state[list][windowId], workspace.getClient(windowId), true);
            }
        }
    }
}

function shiftDesktops (start, reverse) {
    log("Shifting from desktop " + start, undefined, true);
    const clients = workspace.clientList();
    var direction = -1; 
    
    if (!reverse){
        direction = 1;
        workspace.desktops += 1;
    }
    
    for (var i= 0; i < clients.length; i++) {
        if (clients[i].desktop >= start) {
            clients[i].desktop += direction;
        }
    }
    if (reverse && workspace.desktops > 1) {
        workspace.desktops -= 1;
    }
    updateDesktops(start, direction);
}

function insertDesktop (desktop) {
    if (allClients(desktop).length || desktop > workspace.desktops) {
        log("Inserting new desktop at " + desktop, undefined, true);
        shiftDesktops(desktop, false);
    }
}

function removeDesktop (desktop) {
    if (allClients(desktop).length <= 1) {
        log("Removing new desktop at " + desktop, undefined, true);
        shiftDesktops(desktop + 1, true);
    }
}

function moveToDesktop (client, desktop) {
    log("Moving to desktop " + desktop, client, true);
    client.desktop = desktop;
    workspace.currentDesktop = desktop;
}

function originalDesktop (client) {
    return maximized(client) ? maximized(client) : fullscreen(client);
}

function moveToNextDesktop (client) {
    log("Moving window to next desktop", client, true)
    var next = client.desktop + 1;
    insertDesktop(next);
    moveToDesktop(client, next);
    workspace.activeClient = client;
}

function moveBack (client) {
    log("Moving back to original desktop", client, true)
    var origin = originalDesktop(client);
    removeDesktop(client.desktop);
    moveToDesktop(client, origin);
    if (!client.minimized) {
        workspace.activeClient = client;
    }
}

function fullscreenHandler (client, full, user) {
    if (ignoreClient(client) || maximized(client)) {
        return;
    }
    log("Fullscreen toggled", client)

    if (full) {
        if (allClients(client.desktop).length > 1 || client.desktop == 1) {
            state.fullscreen[client.windowId] = client.desktop;
            moveToNextDesktop(client);
        }
    } else {
        if (fullscreen(client)) {
            moveBack(client);
            removeEntries(client);
        }
    }
}

function maximizedHandler (client, h, v) {
    if (ignoreClient(client) || fullscreen(client)) {
        return;
    }
    log("Maximized toggled", client)

    if (h && v) {
        if (allClients(client.desktop).length > 1|| client.desktop == 1) {
            state.maximized[client.windowId] = client.desktop;
            moveToNextDesktop(client);
        }
    } else {
        if (maximized(client)) {
            moveBack(client);
            removeEntries(client);
        }
    }
}

function addHandler (client) {
    if (ignoreClient(client)) {
        return;
    }
    if (maximizedClients(client.desktop).length || fullscreenClients(client.desktop).length) {
        log("Client added and filled desktop, moving to desktop 1", client)
        moveToDesktop(client, 1);
    }
}

function rmHandler (client) {
    if(fullscreen(client) || maximized(client)) {
        log("Filling client removed", client)
        removeEntries(client);
        workspace.currentDesktop -= 1;
        removeDesktop(workspace.currentDesktop);
    }
}

function swapDesktops (a, b) {
    var clientsA = allClients(a);
    var clientsB = allClients(b);
    clientsA.forEach(function (c) {
        c.desktop = b;
    });
    clientsB.forEach(function (c) {
        c.desktop = a;
    });
}

function minimizedHanlder (client) {
    if (maximized(client) || fullscreen(client)) {
        log("Filling client minimzed", client);
        state.minimized[client.windowId] = client.desktop;
        moveBack(client);
    }
}

function unminimizedHanlder (client) {
    if (minimized(client)) {
        delete state.minimized[client.windowId];
        moveToNextDesktop(client);
    }
}

function desktopChangeHandler (client, previousDesktop) {
    if (ignoreClient(client) || !client.active) {
        return;
    }
    var clients;
    var currentDesktop = client.desktop
    if (maximized(client) || fullscreen(client)) {
        if (currentDesktop == 1) {
            moveToDesktop(client, previousDesktop);
            return;
        }
        clients = allClients(currentDesktop);
    } else {
        clients = fillingClients(currentDesktop);
        if (previousDesktop == 1 && clients.length) {
            insertDesktop(2);
            previousDesktop = 2;
        }
    }
    var toSwap = clients.filter(function (c) {
        return c.windowId != client.windowId
    });
    if (toSwap.length) {
        log("Switching desktop " + previousDesktop + " with " + currentDesktop, undefined);
    }
    toSwap.forEach(function (c) {
        c.desktop = previousDesktop;
    });
}

function install () {
    workspace.clientMaximizeSet.connect(maximizedHandler);
    workspace.clientFullScreenSet.connect(fullscreenHandler);
    workspace.clientMinimized.connect(minimizedHanlder);
    workspace.clientUnminimized.connect(unminimizedHanlder);
    workspace.clientRemoved.connect(rmHandler);
    workspace.clientAdded.connect(addHandler);
    workspace.desktopPresenceChanged.connect(desktopChangeHandler);
    workspace.desktops = 1;

    log("Handler installed");
}

function uninstall () {
    workspace.clientMaximizeSet.disconnect(maximizedHandler);
    workspace.clientFullScreenSet.disconnect(fullscreenHandler);
    workspace.clientMinimized.disconnect(minimizedHanlder);
    workspace.clientUnminimized.disconnect(unminimizedHanlder);
    workspace.clientRemoved.disconnect(rmHandler);
    workspace.clientAdded.disconnect(addHandler);
    workspace.desktopPresenceChanged.disconnect(desktopChangeHandler);

    log("Handler cleared");
}

registerUserActionsMenu (function(client){
    return {
        text: "Maximize to New Desktop",
        items: [
            {
                text: "Enabled",
                checkable: true,
                checked: config.enabled,
                triggered: function() {
                    config.enabled = !config.enabled;
                    if (config.enabled) {
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
