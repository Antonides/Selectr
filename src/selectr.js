function rect(e) {
    const w = window;
    const o = e.getBoundingClientRect();
    const b = document.documentElement || document.body.parentNode || document.body;
    const d = (void 0 !== w.pageXOffset) ? w.pageXOffset : b.scrollLeft;
    const n = (void 0 !== w.pageYOffset) ? w.pageYOffset : b.scrollTop;
    return {
        x1: o.left + d,
        x2: o.left + o.width + d,
        y1: o.top + n,
        y2: o.top + o.height + n,
        height: o.height,
        width: o.width
    };
}

function preventDefault(e) {
    e.preventDefault(e);
}
/**
 * 
 * @param {Object} src 
 * @param {Object} props 
 * @returns {Object}
 */
function extend(src, props) {
    for (const prop in props) {
        if (props.hasOwnProperty(prop)) {
            const val = props[prop];
            if (val && typeof val === 'object' && val.constructor === Object) {
                src[prop] = src[prop] || {};
                extend(src[prop], val);
            } else {
                src[prop] = val;
            }
        }
    }
    return src;
}

class SelectrOption extends Option {
    constructor(...props) {
        super(...props);
    }

    enable() {
        this.disabled = false;
        this.update();
    }

    disable() {
        this.disabled = true;
        this.update();
    }

    select() {
        this.selected = true;
        this.update();
    }

    deselect() {
        this.selected = false;
        this.update();
    }

    update() {
        this.closest("select").selectr.refresh();
    }
}

class Selectr {
    constructor(el, props) {

        this.el = el;

        if (typeof el === "string") {
            this.el = document.querySelector(el);
        }

        this.init(props);
    }

    init(options) {

        if (this.initialised && this.el.selectr === this) {
            return console.warn("Selectr is already initialised");
        }

        this.el.selectr = this;

        const defaultConfig = {
            pagination: false,
            strings: {
                test: "foo",
                placeholder: "Select an option...",
            },
        };

        if (options) {
            this.config = extend(defaultConfig, options);
        }

        this.closed = true;
        this.navIndex = 0;
        this.pageIndex = 0;
        this.multiple = this.el.multiple || this.config.multiple || false;

        this.el.multiple = this.multiple;

        if (this.config.ajax) {
            this.loaded = false;
            fetch(this.config.ajax.url).then(r => r.json()).then((data) => {
                for (const item of data) {
                    const selected = item.hasOwnProperty("selected") && item.selected === true;
                    this.el.add(new SelectrOption(item.text, item.value, selected, selected));
                }
                this.refresh();
                this.loaded = true;
            });
        }

        if (this.config.data) {
            const data = this.config.data;

            for (const item of data) {
                if (item.options) {
                    const optgroup = document.createElement("optgroup");
                    optgroup.label = item.text;

                    for (const option of item.options) {
                        const o = new SelectrOption(option.text, option.value, option.selected, option.selected);
                        o.disabled = option.disabled;
                        optgroup.appendChild(o);
                    }

                    this.el.add(optgroup);
                } else {
                    const o = new SelectrOption(item.text, item.value, item.selected, item.selected);
                    o.disabled = item.disabled;
                    this.el.add(o);
                }
            }
        }

        this._render();
        this.bind();

        this.initialised = true;
    }

    refresh() {
        this.options = [...this.el.options];

        if (this.config.pagination) {
            // for ( const option of this.options ) {
            // 	if ( option.index > (this.pageIndex + 1) * this.config.pagination ) {
            // 		this.el.remove(option);
            // 	}
            // }
        }

        if (this.options.length) {
            this._createList();
            this._renderList(true);

            if (this.multiple) {
                this._renderTags();
            } else {
                const option = this.options[this.el.selectedIndex];
                this.nodes.value.dataset.value = option.value;
                this.nodes.value.textContent = option.textContent;
            }
        }

        this.update();
    }

    bind() {
        this.events = {
            click: this._click.bind(this),
            toggle: this._toggle.bind(this),
            blur: this._blur.bind(this),
            navigate: this._navigate.bind(this),
            scroll: this._onListScroll.bind(this),
            over: this._onListOver.bind(this),
        };

        document.addEventListener("mousedown", this.events.blur);
        window.addEventListener("keydown", this.events.navigate);
        this.nodes.display.addEventListener("click", this.events.toggle, false);
        this.nodes.items.addEventListener("scroll", this.events.scroll, false);
        this.nodes.items.addEventListener("mouseover", this.events.over, false);
        this.nodes.items.addEventListener("click", this.events.click, false);

        // stop direction keys scrolling the items
        this.nodes.items.addEventListener("mousedown", preventDefault, false);
    }

    unbind() {
        document.removeEventListener("mousedown", this.events.blur);
        window.removeEventListener("keydown", this.events.navigate);
        this.nodes.display.removeEventListener("click", this.events.toggle);
        this.nodes.items.removeEventListener("click", this.events.click);
    }

    destroy() {
        if (this.initialised) {
            this.unbind();
            this.el.classList.remove("selectr-element");
            this.nodes.container.parentNode.replaceChild(this.el, this.nodes.container);

            // remove reference
            delete this.el.selectr;

            this.initialised = false;
        }
    }

    select(option) {
        let index;

        if (!isNaN(option)) {
            // index
            index = option;
        } else if (option instanceof Element) {
            // option or item
            index = option.index;
        }

        const active = this.options[index];
        const el = this.items[index];
        this.navIndex = index;

        active.selected = !this.multiple ? true : (active.selected ? false : true);

        if (this.multiple) {
            if (this.el.selectedOptions.length) {
                this._renderTags();
            }
        } else {
            this.nodes.value.textContent = el.textContent;
            this.nodes.value.dataset.value = el.dataset.value;
        }

        if (!this.multiple) {
            this.close();
        }

        this.update();
    }

    open() {
        if (this.closed) {
            this.closed = false;
            this.nodes.container.classList.add("selectr-open");

            this._recalculate();
        }
    }

    close() {
        if (!this.closed) {
            this.closed = true;
            this.nodes.container.classList.remove("selectr-open");
        }
    }

    message(text) {
        this.nodes.value.innerHTML = ``;
        this.nodes.value.textContent = text;
    }

    update() {
        this.nodes.container.classList.toggle("has-selected", this.el.selectedOptions.length);
        this.nodes.container.classList.remove("loading");

        for (const option of this.options) {
            const item = this.items[option.index];
            item.classList.toggle("selectr-selected", option.selected);
            item.classList.toggle("disabled", option.disabled);
            item.disabled = option.disabled;
        }

        if (!this.el.selectedOptions.length) {
            this.message(this.config.strings.placeholder);
        }

        this._recalculate();
    }

    _render(type) {

        if (type === undefined) {
            this.el.classList.add("selectr-element");

            const container = document.createElement("div");
            const display = document.createElement("div");
            const value = document.createElement("div");
            const optsContainer = document.createElement("div");
            const items = document.createElement("ul");

            container.classList.add("selectr-container");
            container.classList.toggle("selectr-multiple", this.multiple);

            display.classList.add("selectr-display");

            value.classList.add("selectr-value");

            display.appendChild(value);
            container.appendChild(display);

            optsContainer.classList.add("selectr-options-container");

            items.classList.add("selectr-options");

            optsContainer.appendChild(items);

            container.appendChild(optsContainer);

            this.nodes = {
                container,
                display,
                value,
                items
            };

            this.refresh();

            if (this.config.ajax && !this.loaded) {
                this.nodes.container.classList.add("loading");
                this.message("Loading data...");
            }

            this.el.parentNode.insertBefore(container, this.el);
            container.appendChild(this.el);
        } else {
            switch (type) {
                case "list":
                    this._renderList();
                    break;
                case "tags":
                    this._renderTags();
                    break;
                case "tag":
                    this._renderTag();
                    break;
            }
        }
    }

    _createList() {
        const optgroups = this.el.querySelectorAll("optgroup");
        const createItem = (option) => {
            const item = document.createElement("li");
            item.classList.add("selectr-option");
            item.classList.toggle("selectr-selected", option.selected);
            item.classList.toggle("disabled", option.disabled);

            item.textContent = option.textContent;
            item.dataset.value = option.value;
            item.disabled = option.disabled;
            item.index = option.index;

            return item;
        };

        if (optgroups.length) {
            this.items = [];
            this.groups = [];
            this.nodes.items.classList.add("optgroups");
            for (const group of optgroups) {
                const opt = document.createElement("ul");
                const label = document.createElement("li");

                label.classList.add("selectr-optgroup--label");
                label.textContent = group.label;

                opt.classList.add("selectr-optgroup");
                opt.appendChild(label);

                this.groups.push(opt);
                for (const option of group.children) {
                    const item = createItem(option);
                    opt.appendChild(item);
                    this.items.push(item);
                }
            }
        } else {
            this.items = this.options.map(option => createItem(option));
        }
    }

    _renderList(clear) {
        const frag = document.createDocumentFragment();
        const optgroups = this.el.querySelectorAll("optgroup");

        if (optgroups.length) {
            for (const group of this.groups) {
                frag.appendChild(group);
            }
        } else {
            const collection = this.config.pagination ? this.options.slice(this.pageIndex * this.config.pagination, (this.pageIndex + 1) * this.config.pagination) : this.options;
            for (const option of collection) {
                frag.appendChild(this.items[option.index]);
            }
        }

        if (clear) {
            this.nodes.items.innerHTML = ``;
        }

        this.nodes.items.appendChild(frag);
    }

    _renderTags() {
        const frag = document.createDocumentFragment();
        for (const option of this.el.selectedOptions) {
            frag.appendChild(this._renderTag(option.textContent, option.value, option.index));
        }
        this.nodes.value.innerHTML = ``;
        this.nodes.value.appendChild(frag);

        // tag addition / removal may have altered the size of the container
        this._recalculate();
    }

    _renderTag(text, value, index) {
        const tag = document.createElement("div");
        tag.classList.add("selectr-tag");
        tag.dataset.value = value;
        tag.index = index;

        const span = document.createElement("span");
        span.textContent = text;

        const button = document.createElement("button");
        button.classList.add("selectr-tag-remove");
        button.type = "button";

        tag.appendChild(span);
        tag.appendChild(button);

        return tag;
    }

    _toggle(e) {

        e.preventDefault();

        if (e.target.closest(".selectr-tag-remove")) {
            const tag = e.target.closest(".selectr-tag");

            this.nodes.value.removeChild(tag);
            this.options[tag.index].selected = false;
            return this.update();
        }

        if (this.closed) {
            this.open();
        } else {
            this.close();
        }
    }

    _click(e) {
        const target = e.target;
        const el = target.closest(".selectr-option");

        e.preventDefault();

        if (el) {

            if (el.disabled) {
                return;
            }

            return this.select(el);
        }
    }

    _recalculate() {
        this.rect = rect(this.nodes.items);
    }

    _onListScroll(e) {
        if (!this.closed && this.config.pagination && this.config.pagination < this.options.length) {
            const st = this.nodes.items.scrollTop;
            const sh = this.nodes.items.scrollHeight;
            const ch = this.nodes.items.clientHeight;

            if (st >= sh - ch) {
                this.pageIndex++;
                this._renderList();
            }
        }
    }

    _onListOver(e) {
        const option = e.target.closest(".selectr-option");

        if (option) {
            this.navIndex = option.index;

            for (const item of this.items) {
                item.classList.toggle("active", item.index === option.index);
            }
        }
    }

    _blur(e) {
        if (!this.nodes.container.contains(e.target)) {
            this.close();
        }
    }

    _navigate(e) {
        if (this.closed) return;

        if (e.which === 13) {
            return this.select(this.navIndex);
        }

        let direction;
        const prevEl = this.items[this.navIndex];
        const lastIndex = this.navIndex;

        switch (e.which) {
            case 38:
                direction = -1;
                if (this.navIndex > 0) {
                    this.navIndex--;
                }
                break;
            case 40:
                direction = 1;
                if (this.navIndex < this.items.length - 1) {
                    this.navIndex++;
                }
        }

        // loop items and skip disabled / excluded items
        while (this.items[this.navIndex].classList.contains("disabled") || this.items[this.navIndex].classList.contains("excluded")) {
            if (this.navIndex > 0 && this.navIndex < this.items.length - 1) {
                if (direction > 0) {
                    this.navIndex++;
                } else {
                    this.navIndex--;
                }
            } else {
                this.navIndex = lastIndex;
                break;
            }
        }

        // Autoscroll the dropdown during navigation
        const item = this.items[this.navIndex];
        const r = rect(item);
        const y = this.nodes.items.scrollTop;

        if (direction < 0) {
            if (r.y1 - this.rect.y1 < 0) {
                this.nodes.items.scrollTop = y + (r.y1 - this.rect.y1);
            }
        } else {
            if (r.y2 > this.rect.y2) {
                this.nodes.items.scrollTop = y + (r.y2 - this.rect.y2);
            }
        }

        if (prevEl) {
            prevEl.classList.remove("active");
        }

        item.classList.add("active");
    }
}