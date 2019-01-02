var state = {
    minimized: {},
    maximized: {},
    fullscreen: {}
};

var config = {
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
    return true;
}
/**
 * 
 * @param {KWin::Client} client
 * removes the saved desktop entries from state.maximized and state.fullscreen  
 */
function removeEntries (client) {
    delete state.maximized[client.windowId];
    delete state.fullscreen[client.windowId];
}

/**
 * 
 * @param {KWin::Client} client
 * returns the number of the saved desktop from the given maximized client
 */
function maximized (client) {
    return state.maximized[client.windowId];
}

/**
 * 
 * @param {KWin::Client} client
 * returns the number of the saved desktop from the given fullscreen client
 */
function fullscreen (client) {
    return state.fullscreen[client.windowId];
}

/**
 * 
 * @param {KWin::Client} client
 * returns the number of the desktop where the client was maximized/fullscreen
 */
function minimized (client) {
    return state.minimized[client.windowId];
}

/**
 * 
 * @param {int} desktop
 * returns all clients from specified desktop which are not on the config.ignoreList 
 */
function allClients (desktop) {
    return workspace.clientList().filter(function(c) {
        return (!desktop || c.desktop == desktop) && !ignoreClient(c)
    });
}

/**
 * 
 * @param {int} desktop
 * returns all clients from specified desktop which are not on the config.ignoreList and are currently fullscreen
 */
function fullscreenClients (desktop) {
    return allClients(desktop).filter(fullscreen);
}

/**
 * 
 * @param {int} desktop
 * returns all clients from specified desktop which are not on the config.ignoreList and are currently maximized 
 */
function maximizedClients (desktop) {
    return allClients(desktop).filter(maximized);
}

/**
 * 
 * @param {int} desktop
 * returns all clients from specified desktop which are not on the config.ignoreList and are currently maximized or fullscreen
 */
function fillingClients (desktop) {
    return fullscreenClients(desktop).concat(maximizedClients(desktop));
}

/**
 * 
 * @param {int} start - which clients should be affected
 * @param {int} value - the value added to the matching entries
 * updates the saved desktop values in the state.maximized, state.fullscreen and state.minimized lists 
 */
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

/**
 * 
 * @param {int} start 
 * @param {int} direction 
 * shifts all desktop one to the right or left(1/-1)
 */
function shiftDesktops (start, direction) {
    log("Shifting from desktop " + start, undefined, true);
    const clients = allClients();
    
    if (direction === 1){
        workspace.desktops += 1;
    }
    
    for (var i= 0; i < clients.length; i++) {
        if (clients[i].desktop >= start) {
            clients[i].desktop += direction;
        }
    }
    if (direction === -1 && workspace.desktops > 1) {
        workspace.desktops -= 1;
    }
    updateDesktops(start, direction);
}

/**
 * 
 * @param {int} desktop 
 * inserts new desktop, when the desktop specified has at least one client
 */
function insertDesktop (desktop) {
    if (allClients(desktop).length || desktop > workspace.desktops) {
        log("Inserting new desktop at " + desktop, undefined, true);
        shiftDesktops(desktop, 1);
    }
}

/**
 * 
 * @param {int} desktop
 * removes the specified desktop when it's empty 
 */
function removeDesktop (desktop) {
    if (allClients(desktop).length <= 1) {
        log("Removing new desktop at " + desktop, undefined, true);
        shiftDesktops(desktop + 1, -1);
    }
}

/**
 * 
 * @param {KWin::Client} client 
 * @param {int} desktop 
 * moves the client to specified desktop and activates it when the client is not minimized
 */
function moveToDesktop (client, desktop) {
    log("Moving to desktop " + desktop, client, true);
    client.desktop = desktop;
    if (client.minimized) {
        workspace.currentDesktop = desktop;
    } else {
        activateClient(client);
    }
}

/**
 * 
 * @param {KWin::Client} client 
 * returns the desktop where the client got maximized/fullscreen set
 */
function savedDesktop (client) {
    return maximized(client) ? maximized(client) : fullscreen(client);
}

/**
 * 
 * @param {KWin::Client} client 
 * moves the client to the desktop right next to it 
 */
function moveToNextDesktop (client) {
    log("Moving window to next desktop", client, true)
    var next = client.desktop + 1;
    insertDesktop(next);
    moveToDesktop(client, next);
}

/**
 * 
 * @param {KWin::Client} client 
 * moves the client back to the desktop where it got maximized/fullscreen set
 */
function moveBack (client) {
    log("Moving back to original desktop", client, true)
    var origin = savedDesktop(client);
    removeDesktop(client.desktop);
    moveToDesktop(client, origin);
}

/**
 * 
 * @param {KWin::Client} client 
 * @param {bool} full 
 * @param {bool} user
 * the handler which is responsible for fullscreen events
 */
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

/**
 * 
 * @param {KWin::Client} client 
 * @param {bool} h
 * @param {bool} v
 * the handler which is responsible for maximize events
 */
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

/**
 * 
 * @param {KWin::Client} client
 * the handler which is responsible for new added clients
 */
function addHandler (client) {
    if (ignoreClient(client)) {
        return;
    }
    if (maximizedClients(client.desktop).length || fullscreenClients(client.desktop).length) {
        log("Client added and filled desktop, moving to desktop 1", client)
        moveToDesktop(client, 1);
    }
}

/**
 * 
 * @param {KWin::Client} client
 * the handler which is responsible for removed clients
 */
function rmHandler (client) {
    if(fullscreen(client) || maximized(client)) {
        log("Filling client removed", client)
        removeEntries(client);
        workspace.currentDesktop -= 1;
        removeDesktop(workspace.currentDesktop);
    }
}


/**
 * 
 * @param {KWin::Client} client
 * the handler which is responsible for minimze events
 */
function minimizedHanlder (client) {
    if (maximized(client) || fullscreen(client)) {
        log("Filling client minimzed", client);
        state.minimized[client.windowId] = client.desktop;
        moveBack(client);
    }
}

/**
 * 
 * @param {KWin::Client} client
 * the handler which is responsible for unminimze events
 */
function unminimizedHanlder (client) {
    if (minimized(client)) {
        delete state.minimized[client.windowId];
        moveToNextDesktop(client);
    }
}

/**
 * 
 * @param {KWin::Client} client
 * @param {int} previousDesktop
 * the handler which is responsible for desktop switch events
 */
function desktopChangeHandler (client, previousDesktop) {
    log("Desktop presence changed to desktop " + client.desktop, client);
    if (ignoreClient(client) || !client.active) {
        return;
    }
    var clients;
    var currentDesktop = client.desktop
    if (maximized(client) || fullscreen(client)) {
        if (currentDesktop == 1) {//special case to keep filling windows from desktop 1
            log("Filling windows are not allowed on desktop 1!", client, true);
            moveToDesktop(client, previousDesktop);
            return;
        }
        clients = allClients(currentDesktop);
    } 
    else {
        clients = fillingClients(currentDesktop);
        if (previousDesktop == 1 && clients.length) { //special case to keep the first dekstop
            insertDesktop(2);
            moveToDesktop(client, 2);
            return;
        }
    }
    var toSwap = clients.filter(function (c) {
        return c.windowId != client.windowId
    });

    if (toSwap.length) {
        log("Switching desktop " + previousDesktop + " with " + currentDesktop, undefined, true);
    }

    toSwap.forEach(function (c) {
        c.desktop = previousDesktop;
    });
    if (previousDesktop > 1 && !allClients(previousDesktop).length) { //remove empty desktop
        removeDesktop(previousDesktop);
    }
}

function debug(c) {
    log("Client activated", c);
}

function install () {
    workspace.clientMaximizeSet.connect(maximizedHandler);
    workspace.clientFullScreenSet.connect(fullscreenHandler);
    //workspace.clientMinimized.connect(minimizedHanlder);
    //workspace.clientUnminimized.connect(unminimizedHanlder);
    workspace.clientRemoved.connect(rmHandler);
    workspace.clientAdded.connect(addHandler);
    //workspace.desktopPresenceChanged.connect(desktopChangeHandler);
    //workspace.clientActivated.connect(debug);
    workspace.desktops = 1;

    log("Handler installed");
}

function uninstall () {
    workspace.clientMaximizeSet.disconnect(maximizedHandler);
    workspace.clientFullScreenSet.disconnect(fullscreenHandler);
    //workspace.clientMinimized.disconnect(minimizedHanlder);
    //workspace.clientUnminimized.disconnect(unminimizedHanlder);
    workspace.clientRemoved.disconnect(rmHandler);
    workspace.clientAdded.disconnect(addHandler);
    //workspace.desktopPresenceChanged.disconnect(desktopChangeHandler);

    log("Handler cleared");
}

install();


