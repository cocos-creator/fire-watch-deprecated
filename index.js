var Path = require('fire-path');
var PathWatcher = require('pathwatcher');
var Gulp = require('gulp');
var EventStream = require ('event-stream');

var files = {};
var changes = {};

function _watch () {
    return EventStream.through(function (file) {
        if ( file.stat.isDirectory() ) {
            files[file.path] = [];

            PathWatcher.watch( file.path, function ( event, path ) {
                changes[file.path] = { command: event, path: path };
            } );
        }
        else {
            var dirpath = Path.dirname(file.path);
            files[dirpath].push(file);
        }
    });
}

function start ( root, cb ) {
    Gulp.src( [root, Path.join(root,"**/*")], { cwd: root, base: root, read: false } )
        .pipe ( _watch() ).on( "end", function () {
            if ( cb ) cb ();
        })
        ;
}

function stop ( cb ) {
    PathWatcher.closeAllWatchers();

    // TODO: diff changes and return results
    cb (changes);
}

module.exports = {
    start: start,
    stop: stop
};
