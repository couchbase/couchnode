class ReadResultRow
{
    constructor() {
        this.path = '';
        this.value = [];
    }
}

class ReadResultData
{
    constructor() {
        this.cas = null;
        this.content = [];
    }

    getAtPath(path) {

    }
}

class ReadResult {
    constructor() {
        this.path = '';
        this.data = new ReadResultData();
    }

    path(path) {
        if (!this.path) {
            this.path = path;
        } else {
            this.path += '.' + path;
        }
    }

    get() {
        return this.data.getAtPath(this.path);
    }
}

// Basically, expand on Readresult

// As<T>(string path)

// then you went down.down.down.down.down.some.some.path()