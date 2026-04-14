// ==UserScript==
// @name         Data Mapping Helper
// @namespace    http://tampermonkey.net/
// @version      2026-03-18
// @description  try to take over the world!
// @author       You
// @match        https://*.force.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=force.com
// @grant        none
// ==/UserScript==



(function() {


var DataCloudMappingHelper = {
    sources: [],
    destinations: [],
    lines: [],
    showSysFields: false,

    linesInterval: null,

    paths: {
        sources: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section:nth-child(1) > runtime_cdp-data-stream-source-entities > div > div.slds-m-top_small > runtime_cdp-data-stream-source-entity-list',
        destinations: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section.target-container > runtime_cdp-data-stream-target-entities > div > div.entities-container > runtime_cdp-data-stream-target-entity-list',
        sourceFilter: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section:nth-child(1) > runtime_cdp-data-stream-source-entities > div > lightning-input > lightning-primitive-input-simple > div > div > .slds-input',
        destinationFilter: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section.target-container > runtime_cdp-data-stream-target-entities > div > div.header-outer-container > div > lightning-input > lightning-primitive-input-simple > div > div > .slds-input',
        sourceSysFields: '#brandBand_2 > div > div > div > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section:nth-child(1) > runtime_cdp-data-stream-source-entities > div > div.slds-m-top_small > runtime_cdp-data-stream-source-entity-list:nth-child(1) > div > div > runtime_cdp-data-stream-attribute-list > runtime_cdp-data-stream-attribute-list-item',
        lines: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section.lines-container > runtime_cdp-data-stream-lines > svg > path',
        sourceSysFieldsHeader: '#brandBand_2 > div > div > div.windowViewMode-normal.oneContent.active.lafPageHost > runtime_cdp-data-stream-tagging-container > div > div > article > runtime_cdp-data-stream-tagging-component > div > section:nth-child(1) > runtime_cdp-data-stream-source-entities > div > div.slds-m-top_small > runtime_cdp-data-stream-source-entity-list:nth-child(1) > div > h3'
    },

    querySelectorAllDeep: function(selector, root = document) {
        const results = [];

        // 1. Check if the current root itself matches (if it's an Element)
        if (root.matches && root.matches(selector)) {
            results.push(root);
        }

        // 2. Search the immediate children or shadow tree
        // We use querySelectorAll to find matches within the current scope
        const matches = root.querySelectorAll(selector);
        results.push(...Array.from(matches));

        // 3. Recursively dive into all elements to find Shadow Roots
        // We check every single element to see if it hosts a shadowRoot
        const allElements = root.querySelectorAll('*');

        allElements.forEach(el => {
            if (el.shadowRoot) {
            // If a shadowRoot exists, dive into it recursively
            const shadowMatches = this.querySelectorAllDeep(selector, el.shadowRoot);
            results.push(...shadowMatches);
            }
        });

        // 4. Remove duplicates (in case of overlapping matches)
        return [...new Set(results)];
        },

    updateConnectionLines: function(){
        this.lines.forEach(line => {
            if(line?.getAttribute("d")?.includes("M -")){
                line.style.display = "none";
            }
            else {
                line.style.display = "";
            }
        })
    },

    createDropdown: function(options, onChange){
        const selectElement = document.createElement("select");

        selectElement.setAttribute('class', 'bizcuit-data-mapping-helper')

        selectElement.setAttribute("style", `
            width: 100%;
            padding: 7px 5px;
            border: 1px solid #555555;
            color: #555555;
            border-radius: 5px;
            margin-top: 10px;
        `);

        const showAllOption = document.createElement("option");
        showAllOption.value = "-1";
        showAllOption.text = "Show All";
        selectElement.appendChild(showAllOption);

        options.forEach((option, index) => {
            const optionElement = document.createElement("option");
            optionElement.value = index;
            optionElement.text = option.label;
            selectElement.appendChild(optionElement);
        });

        selectElement.addEventListener('change', (event) => {
            const value = event.target.value;
            onChange(value);

            this.updateConnectionLines();

            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 750);
        });

        return selectElement;
    },

    createSysFieldsToggle: function(){
        const header = this.querySelectorAllDeep(this.paths.sourceSysFieldsHeader);
        if(header?.[0] && !header?.[0]?.querySelector('a')?.length){
            header[0].innerHTML += " (<a>toggle sys_fields</a>)";
            header?.[0]?.querySelector('a')?.addEventListener('click', () => {
                this.showSysFields = !this.showSysFields;

                if(this.showSysFields) this.showSystemFields();
                else this.hideSystemFields();

                this.updateConnectionLines();

                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 250);
            })
        }
    },

    loadSourcesDestinationsAndLines: function(){
        this.sources = this.querySelectorAllDeep(this.paths.sources).map(e => ({
            element: e,
            label: e?.shadowRoot?.querySelector('h3')?.innerText || "Unknown Source"
        })).filter(s => s.label !== "All Event Data");

        this.destinations = this.querySelectorAllDeep(this.paths.destinations).map(e => ({
            element: e,
            label: e?.shadowRoot?.querySelector('h3')?.innerText || "Unknown Destination"
        }));

        this.lines = this.querySelectorAllDeep(this.paths.lines);
    },

    appendFilters: function(){
        const sourceFilterElement = this.createDropdown(this.sources, (value) => {
            this.sources.forEach((source, index) => {
                source.element.style.display = (value === "-1" || index.toString() === value) ? "" : "none";
            });

            if(value == "-1"){
                this.showSystemFields();
            }
            else{
                this.hideSystemFields();
            }
        });

        const destinationFilterElement = this.createDropdown(this.destinations, (value) => {
            this.destinations.forEach((destination, index) => {
                destination.element.style.display = (value === "-1" || index.toString() === value) ? "" : "none";
            });

        });

        const sourceFilterSearchElement = this.querySelectorAllDeep(this.paths.sourceFilter)?.[0];
        const destinationFilterSearchElement = this.querySelectorAllDeep(this.paths.destinationFilter)?.[0];

        if(sourceFilterSearchElement){
            sourceFilterSearchElement.parentElement.appendChild(sourceFilterElement);
        }

        if(destinationFilterSearchElement){
            destinationFilterSearchElement.parentElement.appendChild(destinationFilterElement);
        }
    },

    hideSystemFields: function(){
        this.showSysFields = false;

        const sysFieldElements = this.querySelectorAllDeep(this.paths.sourceSysFields);
        sysFieldElements.forEach(el => {
            if(el?.getAttribute("data-tid")?.includes("cdp_sys_")){
                el.style.display = "none";
            }
        });
    },

    showSystemFields: function(){
        this.showSysFields = true;

        const sysFieldElements = this.querySelectorAllDeep(this.paths.sourceSysFields);
        sysFieldElements.forEach(el => {
            if(el?.getAttribute("data-tid")?.includes("cdp_sys_")){
                el.style.display = "";
            }
        });
    },

    restore: function(){
        const sourceFilterElement = this.querySelectorAllDeep(this.paths.sourceFilter)?.[0]?.parentElement?.querySelector('select');
        const destinationFilterElement = this.querySelectorAllDeep(this.paths.destinationFilter)?.[0]?.parentElement?.querySelector('select');

        if(sourceFilterElement){
            sourceFilterElement.remove();
        }

        if(destinationFilterElement){
            destinationFilterElement.remove();
        }

        this.sources.forEach(source => source.element.style.display = "");
        this.destinations.forEach(destination => destination.element.style.display = "");

        this.sources = [];
        this.destinations = [];

        this.updateConnectionLines();

        this.showSystemFields();

        if(this.linesInterval){
            clearInterval(this.linesInterval);
            this.linesInterval = null;
        }
    },

    init: function(){
        this.restore();
        this.loadSourcesDestinationsAndLines();
        this.appendFilters();
        this.updateConnectionLines();

        this.hideSystemFields();

        this.createSysFieldsToggle();

        this.linesInterval = setInterval(() => {
            this.updateConnectionLines();
        }, 500);

        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 500);
    }
}

let checkInterval = setInterval(() => {
    console.log("waiting for mapping elements to appear on the page");
    if(DataCloudMappingHelper.querySelectorAllDeep(DataCloudMappingHelper.paths.sources)?.length > 1){
        console.log("found mapping elements to appear on the page");
        clearInterval(checkInterval);
        setTimeout(() => {
            DataCloudMappingHelper.init();
        }, 5000);
    }
}, 500);


})();
