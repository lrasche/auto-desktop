var state = {
    maximized: {},
    fullscreen: {}
};

var options = {
    enabled: true,
    ignoreList: ["plasmashell", "lattedock", "krunner"]
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

//checks if the given client should be ignored
function ignoreClient(client) {
    if (client.normalWindow && options.ignoreList.indexOf(client.resourceClass.toString()) == -1) {
        return false;
    }
    log("Ignoring client", client, true)
    return true;
}

function isMaximized (client) {
    return state.maximized[client.windowId];
}

function isFullscreen (client) {
    return state.fullscreen[client.windowId];
}

function desktopClients (desktop) {
    return workspace.clientList().filter(c => c.desktop = desktop && !ignoreClient(c));
}

function desktopFullscreenClients (desktop) {
    return desktopClients(desktop).filter(isFullscreen);
}

function desktopMaximizedClients (desktop) {
    return desktopClients(desktop).filter(isMaximized);
}

function updateDesktops(start, value) {
    log("Updating savedDesktops");
    for (let list in Object.keys(state)) {
        for(var windowId in state.maximized){
            if (state[list][windowId] >= start) {
                state[list][windowId] += value;
                log("Updating savedDesktop to " + state[list][windowId], workspace.getClient(windowId), true);
            }
        }
    }
}

function shiftDesktops(start, reverse) {
    const clients = workspace.clientList();
    var direction = -1; 
    
    if (!reverse){
        direction = 1;
        workspace.desktops += 1;
    }
    
    for (var i= 0; i < clients.length; i++) {
        if (clients[i].isCurrentTab && clients[i].desktop >= start) {
            clients[i].desktop += direction;
        }
    }
    if (reverse && workspace.desktops > 1) {
        workspace.desktops -= 1;
    }
    updateDesktops(start, direction);
}

function insertDesktop (desktop) {
    if (desktopClients(desktop)) {
        shiftDesktops(desktop, false);
    }
}

function removeDesktop (desktop) {
    if (!desktopClients(desktop).length) {
        shiftDesktops(desktop + 1, true);
    }
}

function moveToNextDesktop(client) {
    log("Moving window to new desktop", client, true)
    insertDesktop(client.desktop +1,);
    client.desktop += 1;
    workspace.currentDesktop += 1;
    workspace.activeClient = client;
}

function moveBack(client, desktop, deleted) {
    log("Resotring client to desktop " + desktop, client, true);

    delete state.maximized[client.windowId];
    delete state.fullscreen[client.windowId];

    const current = workspace.currentDesktop;
    if (deleted) {
        workspace.currentDesktop = desktop;
    } else {
        client.desktop = desktop;
        workspace.currentDesktop = desktop;
        workspace.activeClient = client;
    }

    removeDesktop(current);
}

function fullscreenHandler(client, full, user) {
    log("Fullscreen toggled", client)
    if (ignoreClient(client)) {
        return;
    }

    if (full) {
        if (desktopClients(client.desktop).length) {
            moveToNextDesktop(client);
        }
    } else {
        var saved = isFullscreen(client);
        if (saved === undefined) {
            log("Ignoring client not previously seen", client, true);
        } else {
            if (isMaximized(client) == undefined) {
                moveBack(client, saved.desktop);
            }
        }
    }
}

function maximizedHandler(client, h, v) {
    log("Maximized toggled", client)
    if (ignoreClient(client)) {
        return;
    }

    if (h && v) {
        if (desktopClients(client.desktop).length) {
            moveToNextDesktop(client);
        }
    } else {
        var saved = isMaximized(client);
        if (saved === undefined) {
            log("Ignoring client not previously seen", client, true);
        } else {
            if (isFullscreen(client) == undefined) {
                moveBack(client, saved.desktop);
            }
        }
    }
}

function addHandler(client) {
    if (ignoreClient(client)) {
        return;
    }
    if (desktopMaximizedClients(client.desktop).length || desktopFullscreenClients(client.desktop).length) {
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

    if(isFullscreen(client) || isMaximized(client)) {
        moveBack(client, 1, true);
    }
}

function install() {
    workspace.clientMaximizeSet.connect(maximizedHandler);
    workspace.clientFullScreenSet.connect(fullscreenHandler);
    workspace.clientRemoved.connect(rmHandler);
    workspace.clientAdded.connect(addHandler);
    workspace.desktops = 1;
    log("Handler installed");
}

function uninstall() {
    workspace.clientMaximizeSet.disconnect(maximizedHandler);
    workspace.clientFullScreenSet.disconnect(fullscreenHandler);
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
                checked: options.enabled,
                triggered: function() {
                    options.enabled = !options.enabled;
                    if (options.enabled) {
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
