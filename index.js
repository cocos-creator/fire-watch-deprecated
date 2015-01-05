var Fs = require('fire-fs');
var Path = require('fire-path');
var PathWatcher = require('pathwatcher');
var Gulp = require('gulp');
var EventStream = require ('event-stream');
var Util = require ('util');
var Events = require ('events');

function _watch ( watcher ) {
    return EventStream.through(function (file) {
        var parent = watcher.files[Path.dirname(file.path)];
        parent.children.push( file.path );

        watcher.files[file.path] = { file: file, children: [] };
        PathWatcher.watch( file.path, function ( event, path ) {
            // console.log("DEBUG: %s, %s, %s", event, file.path, path);

            watcher.changes[file.path] = { command: event, path: file.path, relatedPath: path };
            // TODO: _cooldown(watcher);
        } );
    });
}

function _cooldown ( watcher ) {
    clearTimeout(watcher.timer);
    watcher.timer = setTimeout(function () {
        _flush(watcher);
    }, 500);
}

function _flush ( watcher ) {
    var sortedChanges = [];
    for ( var k in watcher.changes ) {
        sortedChanges.push(watcher.changes[k]);
    }
    watcher.changes = {};

    //
    sortedChanges.sort( function ( a, b ) {
        return a.path.localeCompare(b.path);
    });
    var results = _computeResults( watcher.files, sortedChanges );

    //
    watcher.emit( 'changed', results );

}

function _computeResults ( files, changes ) {
    function getFiles ( path ) {
        if ( !Fs.existsSync(path) )
            return [];

        return Fs.readdirSync(path)
        .filter( function ( name ) {
            return name[0] !== ".";
        })
        .map( function ( name ) {
            return Path.join( path, name );
        })
        ;
    }
    function fastRemove ( array, nth, len ) {
        array[nth] = array[len-1];
    }

    var results = {};

    for ( var i = 0; i < changes.length; ++i ) {
        var info = changes[i];
        var fileInfo = files[info.path];

        if ( !fileInfo ) {
            results.push( { command: 'new', path: info.path } );
            continue;
        }

        // get file
        var file = fileInfo.file;

        // if changed file is folder
        if ( file.stat.isDirectory() ) {
            var oldFiles = fileInfo.children.slice();
            var newFiles = getFiles( file.path );
            var sameFiles = [];
            var oldLen = oldFiles.length;
            var newLen = newFiles.length;
            var j, jj, path, stat;

            for ( j = 0; j < newLen; ++j ) {
                for ( jj = 0; jj < oldLen; ++jj ) {
                    var newpath = newFiles[j];
                    var oldpath = oldFiles[jj];

                    if ( newpath === oldpath ) {
                        sameFiles.push(newpath);

                        fastRemove( newFiles, j, newLen );
                        newLen -= 1; --j;

                        fastRemove( oldFiles, jj, oldLen );
                        oldLen -= 1; --jj;

                        break;
                    }
                }
            }

            for ( j = 0; j < newLen; ++j ) {
                path = newFiles[j];
                results[path] = { command: "new", path: path };
            }

            for ( j = 0; j < oldLen; ++j ) {
                path = oldFiles[j];
                results[path] = { command: "delete", path: path };
            }

            for ( j = 0; j < sameFiles.length; ++j ) {
                path = sameFiles[j];
                stat = Fs.statSync(path);
                if ( files[path].file.stat.mtime.getTime() !== stat.mtime.getTime() ) {
                    results[path] = { command: "change", path: path };
                }
            }
        }
        else {
            if ( info.command === "change" ) {
                results[info.path] = { command: "change", path: info.path };
            }
            else if ( info.command === "rename" ) {
                results[info.path] = { command: "delete", path: info.path };
                results[info.relatedPath] = { command: "new", path: info.relatedPath };
            }
            else if ( info.command === "delete" ) {
                results[info.path] = { command: "delete", path: info.path };
            }
        }
    }

    return results;
}

function FireWatch () {
    Events.EventEmitter.call(this);

    this.files = {};
    this.changes = {};
    this.timer = null;
}

Util.inherits( FireWatch, Events.EventEmitter );

FireWatch.prototype.stop = function ( cb ) {
    //
    setTimeout( function () {
        PathWatcher.closeAllWatchers();
        clearTimeout(this.timer);

        _flush(this);
        this.files = {};

        if ( cb ) cb();
    }.bind(this), 100 );
};

FireWatch.start = function ( root, cb ) {
    var watcher = new FireWatch();
    watcher.files[Path.dirname(root)] = { file: null, children: [] };

    Gulp.src( [root, Path.join(root,"**/*")], { cwd: root, base: root, read: false } )
        .pipe ( _watch(watcher) ).on( "end", function () {
            if ( cb ) cb ();

            // DEBUG
            // console.log(PathWatcher.getWatchedPaths());
        })
        ;

    return watcher;
};

module.exports = FireWatch;
