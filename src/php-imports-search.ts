import { EMPTY, from, of } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import * as sourcegraph from 'sourcegraph'

export function activate(): void {
   sourcegraph.search.registerQueryTransformer({
       transformQuery: (query: string) => {
           const phpImportsRegex = /\bphp.imports:([^\s]*)/
           if (query.match(phpImportsRegex)) {
               const phpImportsFilter = query.match(phpImportsRegex)
               const phpPkg = phpImportsFilter && phpImportsFilter.length >= 1 ? phpImportsFilter[1] : ''
               const phpImport = '\\buse\\s(?:.*)' + phpPkg + '[^\\s]*;$'
               return query.replace(phpImportsRegex  , `(${phpImport})`)
           }
           return query
        }
   })

   sourcegraph.workspace.onDidOpenTextDocument.subscribe(doc => {
        from(doc.text.split('\n')).pipe(
            concatMap(
                (line, lineNumber) => {
                    const phpPkgRegex = /\buse(?:.*)\s([^\s]*)(?:[^\s]*);$/
                    const match = phpPkgRegex.exec(line);
                    if (match && match.length > 1) {
                        let pkgName = match[1]
                        pkgName = pkgName.replace(new RegExp(/\\/, 'g'), '\\\\')
                        return of({lineNumber, pkgName});
                    }
                    return EMPTY;
                }
            ),
            toArray()
        ).subscribe(matches => {
            if (!matches) {
                return
            }
            if (
                sourcegraph.app.activeWindow &&
                sourcegraph.app.activeWindow.visibleViewComponents.length >
                    0
            ) {
                sourcegraph.app.activeWindow.visibleViewComponents[0].setDecorations(
                    null,
                    matches.map(match => ({
                            range: new sourcegraph.Range(
                                new sourcegraph.Position(match.lineNumber, 0),
                                new sourcegraph.Position(match.lineNumber, 0)
                            ),
                            after: {
                                contentText: ' See all usages',
                                linkURL: '/search?q=php.imports:' + match.pkgName,
                                backgroundColor: 'pink',
                                color: 'black'
                            }
                    })
                ))
            }
            });
    });
}
