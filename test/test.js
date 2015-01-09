var FireWatch = require('../index');
var Fs = require('fire-fs');
var Path = require('fire-path');

function reset () {
    Fs.rimrafSync("./test/foobar/");
    Fs.copySync("./test/test-data/", "./test/foobar");

    Fs.rimrafSync("./test/foobar-trash/");
    Fs.mkdirSync("./test/foobar-trash/");
}

function printResults ( results ) {
    console.log();
    console.log("    ---------------- results ----------------");
    results.forEach( function ( item ) {
        var text = "    %s: %s " + (item.isDirectory ? "[folder]" : "");
        console.log( text, item.command, item.path );
    });
}
function mapResults ( results ) {
    return results.map( function ( item ) {
        item.path = Path.join(root, item.path);
        return item;
    });
}

reset();
var root = Fs.realpathSync("./test/foobar/");

describe('FireWatch Simple Case', function () {
    it('should work for new file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start(root, function () {
            Fs.writeFileSync(Path.join(root, "foo/foo-01/foobar-new.js"), "Hello World!");
            Fs.writeFileSync(Path.join(root, "foo/foobar-new.js"), "Hello World!");

            watcher.stop( function () { done(); } );
        });
        watcher.on("changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "new", path: "foo/foo-01/foobar-new.js", isDirectory: false },
                { command: "new", path: "foo/foobar-new.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for new folder', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.mkdirSync(Path.join(root, "foo/foo-01-new"));
            Fs.mkdirSync(Path.join(root, "foo-new"));

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "new", path: "foo-new", isDirectory: true },
                { command: "new", path: "foo/foo-01-new", isDirectory: true },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for delete file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync(Path.join(root, "foo/foobar.js"));
            Fs.rimrafSync(Path.join(root, "foo/foo-01/foobar.js"));

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo/foo-01/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foobar.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for delete folder', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync(Path.join(root, "foo/foo-01"));
            Fs.rimrafSync(Path.join(root, "bar"));

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "bar", isDirectory: true },
                { command: "delete", path: "foo/foo-01", isDirectory: true },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for rename file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.renameSync( Path.join(root, "foo/foobar.js"),
                           Path.join(root, "foo/foobar-rename.js") );

            Fs.renameSync( Path.join(root, "foo/foo-01/foobar.js"),
                           Path.join(root, "bar/bar-01/foobar-rename.js") );

            Fs.renameSync( Path.join(root, "foo/foo-02/foobar.js"),
                           Path.join(root, "bar/bar-02/foobar-rename.js") );

            Fs.renameSync( Path.join(root, "foo/foo-03/foobar.js"),
                           Path.join(root, "bar/bar-02/foobar-rename.js") );

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo/foo-01/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foo-02/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foo-03/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foobar.js", isDirectory: false },
                { command: "new", path: "bar/bar-01/foobar-rename.js", isDirectory: false },
                { command: "new", path: "bar/bar-02/foobar-rename.js", isDirectory: false },
                { command: "new", path: "foo/foobar-rename.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for rename folder', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.renameSync( Path.join(root, "foo/foo-01"),
                           Path.join(root, "bar/bar-04") );
            Fs.renameSync( Path.join(root, "foo/foo-02"),
                           Path.join(root, "bar/bar-04/bar-02") );

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo/foo-01", isDirectory: true },
                { command: "delete", path: "foo/foo-02", isDirectory: true },
                { command: "new", path: "bar/bar-04", isDirectory: true },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for editing file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.writeFileSync(Path.join(root,"foo/foobar.js"), "Hello World!");
            Fs.writeFileSync(Path.join(root,"foo/foo-02/foobar.js"), "Hello World!");
            Fs.writeFileSync(Path.join(root,"bar/bar-01/foobar-new.js"), "Hello World!");

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "new", path: "bar/bar-01/foobar-new.js", isDirectory: false },
                { command: "change", path: "foo/foo-02/foobar.js", isDirectory: false },
                { command: "change", path: "foo/foobar.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for move file out side root', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            var root2 = Fs.realpathSync("./test/foobar-trash/");
            Fs.renameSync( Path.join(root, "foo/foobar.js"),
                           Path.join(root2, "foobar.js") );

            Fs.renameSync( Path.join(root, "bar/foobar.js"),
                           Path.join(root2, "bar-foobar.js") );
            Fs.renameSync( Path.join(root2, "bar-foobar.js"),
                           Path.join(root, "bar/foobar.js") );

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo/foobar.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for delete file and meta', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync( Path.join(root, "foobar.js") );
            Fs.rimrafSync( Path.join(root, "foobar.js.meta") );

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foobar.js", isDirectory: false },
                { command: "delete", path: "foobar.js.meta", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for delete folder and meta', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync( Path.join(root, "foo-bar") );
            Fs.rimrafSync( Path.join(root, "foo-bar.meta") );

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo-bar", isDirectory: true },
                { command: "delete", path: "foo-bar.meta", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });
});

describe('FireWatch Compound Case', function () {
    it('should work for rename, new, delete, editing files', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.writeFileSync(Path.join(root,"foo/foobar.js"), "Hello World!");
            Fs.rimrafSync(Path.join(root, "foo/foobar.js"));

            Fs.writeFileSync(Path.join(root,"foo/foo-02/foobar.js"), "Hello World!");
            Fs.writeFileSync(Path.join(root,"bar/bar-01/foobar-new.js"), "Hello World!");

            Fs.renameSync( Path.join(root, "foo/foo-03/foobar.js"),
                           Path.join(root, "bar/bar-03/foobar-rename.js") );

            Fs.rimrafSync(Path.join(root, "foo/foo-01/foobar.js"));
            Fs.rimrafSync(Path.join(root, "bar/bar-03/foobar-rename.js"));

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "foo/foo-01/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foo-03/foobar.js", isDirectory: false },
                { command: "delete", path: "foo/foobar.js", isDirectory: false },
                { command: "new", path: "bar/bar-01/foobar-new.js", isDirectory: false },
                { command: "change", path: "foo/foo-02/foobar.js", isDirectory: false },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });

    it('should work for rename, new, delete folders', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync(Path.join(root, "foo/foo-01"));
            Fs.rimrafSync(Path.join(root, "bar"));

            Fs.renameSync(Path.join(root, "foo"), Path.join(root, "bar-new") );

            Fs.mkdirSync(Path.join(root, "foo-new"));
            Fs.mkdirSync(Path.join(root, "foo-new/foo-01"));

            watcher.stop( function () { done(); } );
        });
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = [
                { command: "delete", path: "bar", isDirectory: true },
                { command: "delete", path: "foo", isDirectory: true },
                { command: "new", path: "bar-new", isDirectory: true },
                { command: "new", path: "foo-new", isDirectory: true },
            ];
            expectResults = mapResults(expectResults);

            results.should.eql(expectResults);
        });
    });
});
