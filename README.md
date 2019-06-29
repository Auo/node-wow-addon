## node-wow-addon
A node-module to install addons for World of Warcraft.

I'm not in any way affiliated with Blizzard or World of Warcraft!

### Features
using the portals wowinterface and curse
* Searching for addons
* Installing addons
* Updating addons
* Scanning current addon folder

### Example
```javascript
const manager = request('node-wow-addon')('/path/to/folder/for/installation/of/addons')

manager.portals.availablePortals // Array of available portals to search from, 'wowinterface', 'curse'
manager.portals['curse'].search('name', (err, searchResults) => {
  //returns an array of search items from specified portal.
  })
manager.portals.['curse'].getAddonInfo(searchResultItem, (err, info) => {
  //takes a search item and retrieves more information
  //you can also take an item from manager.listAddons()
  })

manager.listAddons(addons => {
  //addons is an array  
})

manager.createAddon('name-of-your-awesome-addon', (err, addonPath) => {
  //this can be use to create a completely new addon.
})

manager.installAddon(info, (err, folders) => {
  //requires a info object from either wowinterface or curse.(portals)
  //will return an error or a list of folders installed.
})

manager.deleteAddon('name', err => {
 //tries to uninstall an addon based on its name. if it is not found, and error will be returned
  })

manager.checkForAddonUpdate(info, (err, versionInfo) => {
  //info is from the listAddons function.
  //example return {newVersionAvailable: true, localVerson: '1.0', portalVersion: '2.0'}
  //if newVersionAvailable just install addon again, it will overwrite previous.
})
```

### todo
* Cleanup and restructuring of code
* Move away from Regex for wowinterface
