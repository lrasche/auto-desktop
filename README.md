# kwin-maxmize-to-new-desktop
This is a fork of [Aetf/kwin-maxmize-to-new-desktop](https://github.com/Aetf/kwin-maxmize-to-new-desktop).


## Original-Feature

* Move window to a newly created virtual desktop.
* Move window back to original desktop when restored to normal size or closed.

## Additional-Feature
* The new desktop is on the right to the original one.
* The window only gets moved when there are othe windows on the desktop.
* The desktop only gets removed when its empty after moving the window.

__Note__:
This is triggered by window maximize and fullscreen. Window fullscreen can be enabled by right clicking on the window decoration -> `More Actions` -> `Fullscreen`.
