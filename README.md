## node-wow-addon
A node-module to install addons for World of Warcraft.




### features
using the portals wowinterface and curse
* Searching for addons
* Installing addons
* Updating addons
* Keeping track of addons


```javascript
const manager = request('node-wow-addon')('path-to-folder-for-installation')

manager.portals.availablePortals // Array of available portals to search from, 'wowinterface', 'curse'
manager.portals.ONEPORTALNAME.search('name', (err, searchResults) => {
  //returns an array of search items from specified portal.
  })
manager.portals.ONEPORTALNAME.getAddonInfo(searchResultItem, (err, info) => {
  //takes a search item and retrieves more information, can also take an item from the addons.json file manager.listAddons()
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

```



### todo
* scan addon-folder for installed addons ( difficult since the titles of the addons are not the same as on the portals ( doesn't have to be ))
* filter away addon-packs on wowinterface.( the addon-packs will not be installed correctly, maybe let the user decide upon this?)
* filter away addon-packs on curse ( doesn't seem to be any when you don't use the client)
