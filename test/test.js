var FireWatch = require('../index');
var Fs = require('fire-fs');
var Path = require('fire-path');

function reset () {
    Fs.rimrafSync("./test/foobar/");
    Fs.copySync("./test/test-data/", "./test/foobar");
}

function printResults ( results ) {
    console.log();
    console.log("    ---------------- results ----------------");
    for ( var p in results ) {
        console.log( "    %s: %s", results[p].command, results[p].path );
    }
}

var root = Fs.realpathSync("./test/foobar/");

// TODO:
// Fs.writeFileSync("./test/foobar/foo/foobar.js", "Hello World!");
// Fs.writeFileSync("./test/foobar/foo/foo-02/foobar.js", "Hello World!");
// Fs.writeFileSync("./test/foobar/bar/bar-01/foobar-new.js", "Hello World!");

describe('FireWatch', function () {
    it('should work for new file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start(root, function () {
            Fs.writeFileSync(Path.join(root, "foo/foo-01/foobar-new.js"), "Hello World!");
            Fs.writeFileSync(Path.join(root, "foo/foobar-new.js"), "Hello World!");
        });
        watcher.stop( function () { done(); } );
        watcher.on("changed", function ( results ) {
            printResults(results);
            var expectResults = {};
            var path = "";

            path = Path.join(root, "foo/foo-01/foobar-new.js");
            expectResults[path] = { command: "new", path: path };

            path = Path.join(root, "foo/foobar-new.js");
            expectResults[path] = { command: "new", path: path };

            results.should.eql(expectResults);
        });
    });

    it('should work for new folder', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.mkdirSync(Path.join(root, "foo/foo-01-new"));
            Fs.mkdirSync(Path.join(root, "foo-new"));
        });
        watcher.stop( function () { done(); } );
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = {};
            var path = "";

            path = Path.join(root, "foo/foo-01-new");
            expectResults[path] = { command: "new", path: path };

            path = Path.join(root, "foo-new");
            expectResults[path] = { command: "new", path: path };

            results.should.eql(expectResults);
        });
    });

    it('should work for delete file', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync(Path.join(root, "foo/foobar.js"));
            Fs.rimrafSync(Path.join(root, "foo/foo-01/foobar.js"));
        });
        watcher.stop( function () { done(); } );
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = {};
            var path = "";

            path = Path.join(root, "foo/foobar.js");
            expectResults[path] = { command: "delete", path: path };

            path = Path.join(root, "foo/foo-01/foobar.js");
            expectResults[path] = { command: "delete", path: path };

            results.should.eql(expectResults);
        });
    });

    it('should work for delete folder', function ( done ) {
        this.timeout(10000);
        reset();

        var watcher = FireWatch.start( root, function () {
            Fs.rimrafSync(Path.join(root, "foo/foo-01"));
            Fs.rimrafSync(Path.join(root, "bar"));
        });
        watcher.stop( function () { done(); } );
        watcher.on( "changed", function ( results ) {
            printResults(results);

            var expectResults = {};
            var path = "";

            var list = [
                Path.join(root,"bar"),
                Path.join(root,"bar/bar-01"),
                Path.join(root,"bar/bar-02"),
                Path.join(root,"bar/bar-03"),
                Path.join(root,"bar/foobar.js"),
                Path.join(root,"bar/bar-01/foobar.js"),
                Path.join(root,"bar/bar-02/foobar.js"),
                Path.join(root,"bar/bar-03/foobar.js"),
                Path.join(root,"foo/foo-01"),
                Path.join(root,"foo/foo-01/foobar.js"),
            ];

            list.forEach( function ( path ) {
                expectResults[path] = { command: "delete", path: path };
            });
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
        });
        watcher.stop( function () { done(); } );
        watcher.on( "changed", function ( results ) {
            printResults(results);
            // results.should.eql(expectResults);
        });
    });
});
