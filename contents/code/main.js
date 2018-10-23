var state = {
    savedDesktops: {},
    enabled: true
};

function log(msg) {
    print("Auto-Desktop: " + msg);
}

function clientsOnDesktop(desktop){
    const clients = workspace.clientList();
    var sum = 0;
    for (var i = 0; i < clients.length; i++) {
        if(clients[i].desktop == desktop) {
            sum++;
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
    
    if (reverse && workspace.desktops > 4) {
        workspace.desktops -= 1;
    }
}

function updateSavedDesktops(boundary, value) {
    for(var window in state.savedDesktops){
        if (state.savedDesktops[window] >= boundary) {
            state.savedDesktops[window] += value;
        }
    }
}

function moveToNewDesktop(client) {
    state.savedDesktops[client.windowId] = client.desktop;

    shiftDesktops(client.desktop + 1, false);
    client.desktop += 1;
    workspace.currentDesktop += 1;
    workspace.activateClient = client;
    updateSavedDesktops(workspace.currentDesktop, 1);
}

function moveBack(client) {
    var saved = state.savedDesktops[client.windowId];
    if (saved === undefined) {
        log("Ignoring window not previously seen: " + client.caption);
    } else {
        log("Resotre client desktop to " + saved);
        const old = client.desktop;
        client.desktop = saved;
        workspace.currentDesktop = saved;
        workspace.activateClient = client;
        if (clientsOnDesktop(old) == 0) {
            shiftDesktops(old + 1, true);
        }
        updateSavedDesktops(old, -1);
    }
}

function fullHandler(client, full, user) {
    if (full) {
        if (clientsOnDesktop(client.desktop) > 1) {
            moveToNewDesktop(client);
    }
    } else {
        moveBack(client);
    }
}
function rmHandler(client) {
    moveBack(client);
}

function install() {
    workspace.clientMaximizeSet.connect(fullHandler);
    workspace.clientFullScreenSet.connect(fullHandler);
    workspace.clientRemoved.connect(rmHandler);
    log("Handler installed");
}

function uninstall() {
    workspace.clientFullScreenSet.disconnect(handler);
    workspace.clientMaximizeSet.disconnect(fullHandler);
    workspace.clientRemoved.disconnect(rmHandler);
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
