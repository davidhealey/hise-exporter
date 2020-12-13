/*  
Copyright 2018 David Healey
This file is part of Hise-Exporter.
  
Hise-Exporter is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Hise-Exporter is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Waistline.  If not, see <http://www.gnu.org/licenses/>.
*/

const {app, BrowserWindow, dialog, ipcMain, Menu, session}  = require('electron');
const log = require('electron-log');
const ses = session.defautSession;

console.log = log.log;

process.env.NODE_ENV = 'development';

//Windows
let mainWindow;

function createWindow (width, height, title, html, devTools, parent, show) {
  // Create the browser window.
  let win = new BrowserWindow({
    width: width,
    height: height,
    title: title,
    parent: parent,
    show:show,
    webPreferences: {
      nodeIntegration: true,
    }
  })

  // and load the index.html of the app.
  win.loadFile(html)

  // Open the DevTools.
  if (devTools)
    win.webContents.openDevTools()

  win.on("closed", () => {
    win = null;
  });

  return win;
}

//Fix sandboxing issue on gnux
app.commandLine.appendSwitch('--no-sandbox');

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){

  mainWindow = createWindow(1000, 600, "Main", "src/renderer/index.html", true, null, true, false);

  //Remove main menu
  const emptyMenu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(emptyMenu); //Insert menu

  //Quit app when closed
  mainWindow.on('closed', function(){
    app.quit();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow(1000, 600, "Main", "src/renderer/index.html", true, null, true, false);
  }
})

//Open directory dialog
ipcMain.handle('openDir', (e, args) => {

  if (!args.default) args.default = app.getPath("desktop");

  return dialog.showOpenDialog(mainWindow, {
      properties:["openDirectory"],
      title: args.title,
      defaultPath: args.default,
      filters: args.filters
   });
});

//Open file dialog
ipcMain.handle('openFile', (e, args) => {

  if (!args.default) args.default = app.getPath("desktop");

  return dialog.showOpenDialog(mainWindow, {
      properties:["openFile"],
      title: args.title,
      defaultPath: args.default,
      filters: args.filters,
      dontAddToRecent: true
  });
});