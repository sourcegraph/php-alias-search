import { EMPTY, from, of } from "rxjs";
import { concatMap, toArray } from "rxjs/operators";
import * as sourcegraph from "sourcegraph";

const phpAliasSearchDecorationType = sourcegraph.app.createDecorationType();

export function activate(): void {
    sourcegraph.search.registerQueryTransformer({
        transformQuery: (query: string) => {
            const phpImportsRegex = /\bphp.uses:([^\s]*)/;
            if (query.match(phpImportsRegex)) {
                const phpImportsFilter = query.match(phpImportsRegex);
                const phpPkg =
                    phpImportsFilter && phpImportsFilter.length >= 1
                        ? phpImportsFilter[1]
                        : "";
                const phpImport = "\\buse\\s(?:.*)" + phpPkg + "[^\\s]*;$";
                return query.replace(phpImportsRegex, `${phpImport} lang:php `);
            }
            return query;
        },
    });

    sourcegraph.workspace.onDidOpenTextDocument.subscribe((doc) => {
        if (doc.languageId !== "php" || !doc.text) {
            return;
        }
        from(doc.text.split("\n"))
            .pipe(
                concatMap((line, lineNumber) => {
                    const phpPkgRegex = /\buse(?:.*)\s([^\s]*)(?:[^\s]*);$/;
                    const match = phpPkgRegex.exec(line);
                    if (match && match.length > 1) {
                        let pkgName = match[1];
                        pkgName = pkgName.replace(
                            new RegExp(/\\/, "g"),
                            "\\\\"
                        );
                        return of({ lineNumber, pkgName });
                    }
                    return EMPTY;
                }),
                toArray()
            )
            .subscribe((matches) => {
                if (
                    !matches ||
                    sourcegraph.app.activeWindow?.activeViewComponent?.type !==
                        "CodeEditor"
                ) {
                    return;
                }

                sourcegraph.app.activeWindow.activeViewComponent.setDecorations(
                    phpAliasSearchDecorationType,
                    matches.map((match) => ({
                        range: new sourcegraph.Range(
                            new sourcegraph.Position(match.lineNumber, 0),
                            new sourcegraph.Position(match.lineNumber, 0)
                        ),
                        after: {
                            contentText: "See all usages",
                            linkURL: "/search?q=php.uses:" + match.pkgName,
                            backgroundColor: "pink",
                            color: "black",
                        },
                    }))
                );
            });
    });
}
