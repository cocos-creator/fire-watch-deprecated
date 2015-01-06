var Fs = require('fire-fs');
var Path = require('fire-path');
var PathWatcher = require('pathwatcher');
var Gulp = require('gulp');
var EventStream = require ('event-stream');
var Util = require ('util');
var Events = require ('events');

var commandPriority = { delete: 0, new: 1, change: 2 };

function _dbgPrintResults ( results ) {
    for ( var p in results ) {
        console.log( "%s: %s", results[p].command, results[p].path );
    }
}

function _addResult ( results, command, path, isDirectory ) {
    var result = results[path];
    if ( result ) {
        if ( result.isDirectory !== isDirectory ) {
            throw new Error("We not support file and directory share the same path " + path );
        }

        if ( commandPriority[result.command] > commandPriority[command] ) {
            result.command = command;
        }

        return;
    }

    results[path] = {
        command: command,
        path: path,
        isDirectory: isDirectory
    };
}

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
            _addResult( results, 'new', info.path, Fs.statSync(info.path).isDirectory() );
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
            var j, jj, path, stat, stat2;

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
                stat = Fs.statSync(path);
                _addResult( results, 'new', path, stat.isDirectory() );
            }

            for ( j = 0; j < oldLen; ++j ) {
                path = oldFiles[j];
                stat = files[path].file.stat;
                _addResult( results, 'delete', path, stat.isDirectory() );
            }

            for ( j = 0; j < sameFiles.length; ++j ) {
                path = sameFiles[j];
                stat = files[path].file.stat;
                stat2 = Fs.statSync(path);
                if ( stat.isFile() && stat.mtime.getTime() !== stat2.mtime.getTime() ) {
                    _addResult( results, 'change', path, false );
                }
            }
        }
        else {
            if ( info.command === "change" ) {
                _addResult( results, 'change', info.path, false );
            }
            else if ( info.command === "rename" ) {
                _addResult( results, 'delete', info.path, false );
                _addResult( results, 'new', info.relatedPath, false );
            }
            else if ( info.command === "delete" ) {
                _addResult( results, 'delete', info.path, false );
            }
        }
    }

    var resultList = [];
    for ( var p in results ) {
        resultList.push(results[p]);
    }
    resultList.sort( function ( a, b ) {
        var compareCommand = commandPriority[a.command] - commandPriority[b.command];
        if ( compareCommand !== 0 ) {
            return compareCommand;
        }

        return a.path.localeCompare(b.path);
    } );

    var lastDirectory = null;
    resultList = resultList.filter( function ( r ) {
        if ( lastDirectory &&
             lastDirectory.command === r.command &&
             Path.contains( lastDirectory.path, r.path ) )
        {
            return false;
        }

        if ( r.isDirectory ) {
            lastDirectory = r;
        }
        else {
            lastDirectory = null;
        }
        return true;
    } );
    return resultList;
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
    root = Path.normalize(root);
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
