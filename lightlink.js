const lightLink = (function () {
    // Dont initialize LightLink on IE.
    if (window.document.documentMode) {
        return
    }

    const cache = new Map();
    const headTags = new Map();
    const eventListeners = new Map();
    let pageKey = generatePageKey(window.location.pathname.split("/")[1]);

    history.replaceState({ key: pageKey }, null, window.location.pathname + window.location.search);

    if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
    }

    function generatePageKey(url) {
        return url + "|" + (Math.random() + 1).toString(36).substring(7);
    }

    function getScriptKey() {
        return pageKey.split("|")[0];
    }

    function addEventListener(eventName, func) {
        const listeners = eventListeners.get(getScriptKey() + eventName);
        if (listeners) {
            listeners.push(func)
        } else {
            eventListeners.set(getScriptKey() + eventName, [func]);
        }
    }

    function fireInitialize() {
        listeners = eventListeners.get(getScriptKey() + "initialize");
        if (listeners) {
            for (let i = 0; i < listeners.length; i++) {
                listeners[i]();
            }
        }
    }

    function fireOnload(state) {
        listeners = eventListeners.get(getScriptKey() + "onload");
        if (listeners) {
            for (let i = 0; i < listeners.length; i++) {
                listeners[i](state);
            }
        }
    }

    function fireBeforeunload() {
        const newState = {};
        listeners = eventListeners.get(getScriptKey() + "beforeunload");
        if (!listeners) return;

        for (let i = 0; i < listeners.length; i++) {
            const oldState = listeners[i]();
            if (oldState) {
                const keys = Object.keys(oldState);
                for (let j = 0; j < keys.length; j++) {
                    newState[keys[j]] = oldState[keys[j]]
                }
            }
        }
        return newState;
    }

    const events = (function () {
        return {
            initialize: function (func) {
                // When LightLink gets initialized it will run
                // the initialize functions from window.onload to make sure
                // the page have been loaded -> so dont run it here.
                if (cache.size > 0) {
                    func();
                }
                addEventListener("initialize", func);
            },

            onload: function (func) {
                if (cache.size > 0) {
                    func();
                }

                addEventListener("onload", func);
            },

            beforeunload: function (func) {
                addEventListener("beforeunload", func);
            }
        }
    })();

    function cachePage(key, pageState) {
        if (cache.size == 15) {
            const first = cache.entries().next().value;
            cache.delete(first[0])
        }
        cache.set(key, {
            body: document.body,
            title: document.title,
            scrollPos: document.documentElement.scrollTop,
            state: pageState
        });
    }

    window.onload = () => {
        const tags = document.head.children;
        for (let i = 0; i < tags.length; i++) {
            let element = tags[i];
            const tagName = element.tagName.toLowerCase();

            if (tagName == "script" && element.getAttribute("src")) {
                const idVer = getIdAndVersion(element, "src");
                headTags.set(idVer[0], idVer[1]);
                continue
            }

            if (tagName == "link" && element.getAttribute("href")) {
                const idVer = getIdAndVersion(element, "href");
                headTags.set(idVer[0], idVer[1]);
                continue
            }

            if (tagName == "title") continue

            headTags.set(element.outerHTML, "");
        }

        fireInitialize();
        fireOnload();
    }

    window.onclick = event => {
        if (event.target && event.target.tagName.toLowerCase() === "a"
            && event.target.hasAttribute("data-lightlink")) {
            event.preventDefault();
            const url = event.target.getAttribute("href");
            fetch(url).then(res => res.text())
                .then(html => {
                    const state = fireBeforeunload();
                    cachePage(pageKey, state);
                    pageKey = generatePageKey(url.split("/")[1]);
                    history.pushState({ key: pageKey }, null, url);
                    updateDOM(html);
                })
                .catch(error => {
                    console.log(error);
                    // If there is a network error this will make the
                    // browser show an error instead of having the user press
                    // the link and nothing happens.
                    window.location.href = url;
                });
        }
    }

    window.onpopstate = event => {
        let currentState = fireBeforeunload();
        cachePage(pageKey, currentState);

        pageKey = event.state.key;
        let newState = cache.get(event.state.key);

        if (!newState) {
            fetch(pageKey.split("|")[0]).then(res => res.text())
                .then(html => updateDOM(html))

                .catch(error => {
                    console.log(error);
                    // If there is a network error this will make the
                    // browser show an error instead of having the user press
                    // the link and nothing happens.
                    window.location.href = url;
                });
            return
        }

        document.body = newState.body;
        document.title = newState.title;
        window.scrollTo(0, newState.scrollPos);
        fireOnload(newState.state);
    }

    function updateDOM(html) {
        // Reset the scrollPos when loading a new page.
        window.scrollTo(0, 0);

        const newPage = new DOMParser().parseFromString(html, "text/html");
        const newHeadTags = newPage.head.children;

        document.body = newPage.body;

        const newScriptElements = [];
        for (let i = 0; i < newHeadTags.length; i++) {
            let element = newHeadTags[i];
            const tagName = element.tagName.toLowerCase();

            if (tagName == "script" && element.getAttribute("src")) {
                const idVer = getIdAndVersion(element, "src");
                const scriptID = idVer[0];
                const newVersion = idVer[1];
                const currentVersion = headTags.get(scriptID);

                if (!currentVersion) {
                    headTags.set(scriptID, newVersion);
                    newScriptElements.push(createScriptElement(element))
                    continue
                }

                if (currentVersion != newVersion) {
                    // The script have been updated and the page needs to be reloaded.
                    location.reload();
                    return
                }

                continue
            }

            if (tagName == "link" && element.getAttribute("href")) {
                const idVer = getIdAndVersion(element, "href");
                const linkID = idVer[0];
                const newVersion = idVer[1];
                const currentVersion = headTags.get(linkID);

                if (!currentVersion) {
                    document.head.appendChild(element.cloneNode(true));
                    continue
                }

                if (currentVersion != newVersion) {
                    // The link have been updated and the page needs to be reloaded.
                    location.reload();
                    return
                }
                continue
            }

            if (tagName == "title") {
                document.title = element.textContent;
                continue
            }

            if (headTags.has(element.outerHTML)) {
                continue
            }

            headTags.set(element.outerHTML, "");
            document.head.appendChild(element.cloneNode(true));
        }

        fireInitialize();
        fireOnload();

        for (let i = 0; i < newScriptElements.length; i++) {
            document.head.appendChild(newScriptElements[i])
        }
    }

    function getIdAndVersion(element, attributeName) {
        const llID = element.getAttribute("data-lightlink-id");
        if (llID) {
            return [llID, element.getAttribute(attributeName)];
        }


        divider = element.getAttribute("data-lightlink-divider");
        divider = divider ? divider : ".";

        let src = element.getAttribute(attributeName);
        const s = src.split(divider);
        if (s.length > 1) return [s[0], s[s.length - 2]]

        return [src, ""]
    }

    function createScriptElement(element) {
        const script = document.createElement("script");
        const attrs = element.attributes;
        for (let j = 0; j < attrs.length; j++) {
            const a = attrs[j];
            script.setAttribute(a.name, a.value)
        }
        return script;
    }

    return {
        events: events
    };

})();
