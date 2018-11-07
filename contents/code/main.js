var state = {
    savedDesktops: {},
    enabled: true
};

function ignore(client) {
    const ignoreList = ["plasmashell", "lattedock", "krunner"];
    for (var i in ignoreList) {
        if (ignoreList[i] == client.resourceClass) {
            log("Ignoring " + client.caption)
            return true;
        }
    }
    return false;
}
function log(msg) {
    print("Auto-Desktop: " + msg);
}

function clientsOnDesktop(desktop, noBorder){
    var sum = Infinity;
    if(desktop > 1 && workspace.desktops >= desktop) {
        const clients = workspace.clientList();
        sum = 0;
        for (var i = 0; i < clients.length; i++) {
            if(clients[i].desktop == desktop && !ignore(clients[i]) && (clients[i].noBorder == noBorder || !noBorder) && !clients[i].deleted) {
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
    for(var client in state.savedDesktops){
        if (state.savedDesktops[client] >= boundary) {
            state.savedDesktops[client] += value;
        }
    }
}

function moveToNewDesktop(client) {
    state.savedDesktops[client.windowId] = client.desktop;
    if (clientsOnDesktop(client.desktop +1, false) > 0) {
        shiftDesktops(client.desktop + 1, false);
    }
    client.desktop += 1;
    workspace.currentDesktop += 1;
    workspace.activeClient = client;
    updateSavedDesktops(workspace.currentDesktop, 1);
}

function moveBack(client) {
    var saved = state.savedDesktops[client.windowId];
    if (saved === undefined) {
        log("Ignoring window not previously seen: " + client.caption);
    } else {
        state.savedDesktops[client.windowId] = undefined;
        log("Resotre client desktop to " + saved);
        const old = client.desktop;
        if (clientsOnDesktop(old, false) <= 1) {
            shiftDesktops(old + 1, true);
        }
        updateSavedDesktops(old, -1);
        client.desktop = saved;
        workspace.currentDesktop = saved;
        workspace.activeClient = client;
    }
}

function fullHandler(client, full, user) {
    if (full) {
        if (clientsOnDesktop(client.desktop, false) > 1) {
            moveToNewDesktop(client);
    }
    } else {
        moveBack(client);
    }
}

function addHandler(client) {
    if (!ignore(client) && (clientsOnDesktop(workspace.currentDesktop, true) > 0) && client.normalWindow) {
        log("Moving new window to desktop 1")
        client.desktop = 1;
        workspace.currentDesktop = 1;
        workspace.activeClient = client;
    }
}


function rmHandler(client) {
    log(clientsOnDesktop(workspace.currentDesktop));
    if (clientsOnDesktop(workspace.currentDesktop) <= 1) {
        shiftDesktops(workspace.currentDesktop + 1, true);
        workspace.currentDesktop = 1;
    }
}

function install() {
    workspace.clientMaximizeSet.connect(fullHandler);
    workspace.clientFullScreenSet.connect(fullHandler);
    workspace.clientRemoved.connect(rmHandler);
    workspace.clientAdded.connect(addHandler);
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
