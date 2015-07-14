var Fs = require('fire-fs');
var Path = require('fire-path');
var Util = require ('util');
var Events = require ('events');
var Globby = require ('globby');

// DISABLE
// var Chokidar = require('chokidar');
// var Gulp = require('gulp');
// var EventStream = require ('event-stream');
// var ConvertChokidarCmds = {
//     unlink: 'delete',
//     unlinkDir: 'delete',
//     add: 'new',
//     addDir: 'new',
//     change: 'change',
// };
// var globalDiff = process.platform === 'win32';

var commandPriority = { delete: 0, new: 1, change: 2 };
var globalDiff = true;

function _dbgPrintResults ( results ) {
    for ( var p in results ) {
        console.log( '%s: %s', results[p].command, results[p].path );
    }
}

function _addResult ( results, command, path, isDirectory ) {
    var result = results[path];
    if ( result ) {
        if ( result.isDirectory !== isDirectory ) {
            throw new Error('We not support file and directory share the same path ' + path );
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

// DISABLE
// function _watch ( fireWatcher ) {
//     return EventStream.map(function (file, callback) {
//         fireWatcher.files[file.path] = { file: file, children: [] };

//         var parent = fireWatcher.files[Path.dirname(file.path)];
//         if ( !parent ) {
//             console.error('Watch failed: Can not find path: %s', Path.dirname(file.path) );
//             return callback();
//         }

//         parent.children.push( file.path );

//         var watcher = Chokidar.watch( file.path, {} ).on( 'all',function ( event, path ) {
//             // console.log('DEBUG: %s, %s, %s', event, file.path, path);

//             event = ConvertChokidarCmds[event] || event;

//             if ( event === 'delete' ) {
//                 watcher.close();
//                 var removeAt = fireWatcher.watchers.indexOf(watcher);
//                 if (removeAt !== -1) {
//                     fireWatcher.watchers.splice(removeAt, 1);
//                 }
//             }
//             fireWatcher.changes[file.path] = { command: event, path: file.path, relatedPath: path };
//             // TODO: _cooldown(fireWatcher);
//         } );

//         fireWatcher.watchers.push(watcher);

//         watcher.on('ready', function () {
//             callback(null, file);
//         });
//     });
// }

// DISABLE
// function _cooldown ( fireWatcher ) {
//     clearTimeout(fireWatcher.timer);
//     fireWatcher.timer = setTimeout(function () {
//         _flush(fireWatcher);
//     }, 500);
// }

function _flush ( fireWatcher ) {
    var sortedChanges = [];
    for ( var k in fireWatcher.changes ) {
        sortedChanges.push(fireWatcher.changes[k]);
    }
    fireWatcher.changes = {};

    //
    sortedChanges.sort( function ( a, b ) {
        return a.path.localeCompare(b.path);
    });
    var results = _computeResults( fireWatcher.files, sortedChanges );

    //
    fireWatcher.emit( 'changed', results );
}

function _computeResults ( files, changes ) {
    function getFiles ( path ) {
        if ( !Fs.existsSync(path) )
            return [];

        return Fs.readdirSync(path)
        .filter( function ( name ) {
            return name[0] !== '.';
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
        var changeInfo = changes[i];
        var fileInfo = files[changeInfo.path];

        if ( !fileInfo ) {
            _addResult( results, 'new', changeInfo.path, Fs.statSync(changeInfo.path).isDirectory() );
            continue;
        }

        // get file
        var path, stat, stat2;

        // if changed file is folder
        if ( fileInfo.stat.isDirectory() ) {
            var oldFiles = fileInfo.children.slice();
            var newFiles = getFiles( fileInfo.path );
            var sameFiles = [];
            var oldLen = oldFiles.length;
            var newLen = newFiles.length;
            var j, jj;

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
                stat = files[path].stat;
                _addResult( results, 'delete', path, stat.isDirectory() );
            }

            for ( j = 0; j < sameFiles.length; ++j ) {
                path = sameFiles[j];
                stat = files[path].stat;
                stat2 = Fs.statSync(path);
                if ( stat.isFile() && stat.mtime.getTime() !== stat2.mtime.getTime() ) {
                    _addResult( results, 'change', path, false );
                }
            }
        }
        else {
            if ( changeInfo.command === 'change' ) {
                _addResult( results, 'change', changeInfo.path, false );
            }
            // DISABLE
            // else if ( changeInfo.command === 'rename' ) {
            //     if ( !Fs.existsSync(changeInfo.path) ) {
            //         _addResult( results, 'delete', changeInfo.path, false );
            //     }
            //     else {
            //         _addResult( results, 'change', changeInfo.path, false );
            //     }

            //     if ( Path.contains( file.base, changeInfo.relatedPath ) ) {
            //         _addResult( results, 'new', changeInfo.relatedPath, false );
            //     }
            // }
            else if ( changeInfo.command === 'delete' ) {
                if ( !Fs.existsSync(changeInfo.path) ) {
                    _addResult( results, 'delete', changeInfo.path, false );
                }
                else {
                    _addResult( results, 'change', changeInfo.path, false );
                }
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
        return true;
    } );
    return resultList;
}

function FireWatch () {
    Events.EventEmitter.call(this);

    this.files = {};
    this.changes = {};
    this.timer = null;
    this.watchers = [];
}

Util.inherits( FireWatch, Events.EventEmitter );

FireWatch.prototype.stop = function ( cb ) {
    //
    setTimeout( function () {
        for (var i = 0; i < this.watchers.length; i++) {
            var watcher = this.watchers[i];
            watcher.close();
        }
        this.watchers.length = 0;

        clearTimeout(this.timer);

        _flush(this);
        this.files = {};

        if ( cb ) cb();
    }.bind(this), 100 );
};

FireWatch.start = function ( root, cb ) {
    root = Path.normalize(root);
    var fireWatcher = new FireWatch();
    fireWatcher.files[Path.dirname(root)] = {
        path: Path.dirname(root),
        stat: null,
        children: []
    };

    // DISABLE
    // if ( !globalDiff ) {
    //     Gulp.src( [root, Path.join(root,'**/*')], { cwd: root, base: root, read: false } )
    //         .pipe ( _watch(fireWatcher) ).on( 'end', function () {
    //             if ( cb ) cb ();

    //             // DEBUG
    //             // console.log(PathWatcher.getWatchedPaths());
    //         })
    //         ;
    // }

    Globby( [root, Path.join(root,'**/*')], function ( err, paths ) {
        paths.forEach( function ( path ) {
            path = Path.normalize(path);
            var stat = Fs.statSync(path);
            fireWatcher.files[path] = {
                path: path,
                stat: stat,
                children: [],
            };

            var parent = fireWatcher.files[Path.dirname(path)];
            parent.children.push( path );

            if ( stat.isDirectory() ) {
                fireWatcher.changes[path] = { command: 'change', path: path };
            }
        });

        if ( cb ) cb ();
    });

    return fireWatcher;
};

module.exports = FireWatch;
