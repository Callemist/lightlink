# LightLink

LightLink is a super lightweight framework that give your server side rendered website the feeling and performacne of a single-page application. LightLink will let your server respond with full HTML pages and then swaps out the current `<body>` with the new one. The `<head>` tags will be merged to make sure new `<script>`, `<link>`, `<title>` and `<meta>` tags are loaded. LightLink uses the HTML5 history api and respect normal browser navigation behaviour.

## Functionality

- **Navigation without reloading the page.**
- **Full page caching.**
- **Scroll restoration.**
- **Lifecycle hooks.**
- **Storing state between page visits.**

## What it doesn't do

- Inline Javascript is not supprted / will not run.
- Internet Explore is not supported, however LightLink will not initialize on IE so it should not cause any problems.
- `<base>` tags are currently not supported.

## How to use it.

Start by including the following script on pages that you want to be able to initialize LightLink navigation:
```html
<script src="https://cdn.jsdelivr.net/gh/callemist/lightlink@v1.0.0/lightlink.js"></script>
```
To turn an `<a href>` link into a LightLink simply add the `data-lightlink` attribute to it.
```html
<a href="/page2" data-lightlink>Page2</a>
```
### Lifecycle hooks.
---
To subscribe to a lifecycle event pass it a callback function by calling `lightlink.events.eventName(myFunc);`
```javascript
lightLink.events.initialize(function(){
    console.log("Hello from initialize");
}); 
```
There are three lifecycle hooks.

-  **initialize()** will run the first time the page is loaded.
-  **onload(state)** will run every time the page is loaded.
-  **beforeunload():state** will run before the page is unloaded.

Lifecycle events are tied to the url path on which the script file contaning them where loaded.
In practice this means that a script can not have lifecycle events that fire on more than one path. If you want to include the same script on multiple pages that should run from onload or another event, the best way to do it would be something like this.

```html
<script src="/everypage.js"></script>
<script src="/page-unique-script.js"></script>
```
```javascript
// Inside everypage.js
const everyPage = {
    onload: function() {
        // code
    }
}
```
```javascript
// page-unique-script.js
lightLink.events.onload(function(){
    everyPage.onload();
}); 
```

### Storing state between page visits
---
Each page have it's own state object which is built from the return values of the page scripts beforeunload events.
```javascript
lightLink.events.beforeunload(function () {
    return { myValue: 1 }
}); 
```
This state is then accessible in the onload event the next time the page is loaded.
```javascript
lightLink.events.onload(function (state) {
    console.log(state.myValue) --> 1
}); 
```

**Note that this currently only works when using backward and forward navigation.**

### Cache
---
The cache stores the HTML `<body>` and other necessary information to the restore the page without making a server request on backward or forward navigation. LightLink aims to restore the exact state that the user left when navigating backwards or forward. However the page fetched when pressing a LightLink link is not cached. This is to make sure that the user always get the latest content.

### Reload on asset update
---
The best way to make sure that new assets get loaded is to fingerprint them.
LightLink will extract an id and a version from the the src on script tags and href on link tags. By default this is done by splitting the src/href on the dot (".") character and making the id equal to the first element and the version to the second to last element. If the src is `/assets/main.min.abc123.js` the id would be `/assets/main` and the version would be `abc123`.
If the src is now updated to `/assets/main.min.abc456.js` LightLink will recognize this and reload the page.

It's possible to modify this behaviour either by using the `data-lightlink-divider="/"` to pick your own character to split on or use the preferred way and use `data-lightlink-id="main"`. By giving LightLink a specific id for that script or link it can now use the whole src/href as version which mean that any changes to that src/href will trigger a reload.
