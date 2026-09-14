# Release notice supplements

`supplements.json` maps exact installed package versions to additional notice files. `sources.json` records the pinned upstream sources of those files. `scripts/release-notices.mjs` combines these with notices found in installed npm and Cargo packages.

Most supplements are original upstream license files. Exceptions are explicit: selectors uses the standard MPL-2.0 text referenced by its source headers; objc2-family packages provide upstream licensing statements plus the standard MIT text; seahash declares MIT in Cargo metadata but does not ship a standalone license, so its authors and the standard terms are preserved without inventing a copyright date. Standard template placeholders are not project-specific copyright claims.

The release inventory includes upstream source archive URLs, including the unmodified MPL-covered sources. Where alternatives are available, selected license options are recorded in the mapping. Some build-only dependencies are conservatively included.

An empty `missingLicenseFiles` list means the notice collector has a file or documented supplement for each collected package. It is not legal certification or a guarantee that all possible redistribution obligations have been independently audited. Recheck mappings when updating dependencies.
