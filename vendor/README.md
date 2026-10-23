# vendor

`lwm-luminx-astro-components-0.2.0.tgz` is `npm pack` of [lwm-luminx/astro-components](https://github.com/lwm-luminx/astro-components) at `v0.2.0`. It is checked in because Actions' `GITHUB_TOKEN` can't read that private package from GitHub Packages (`403 permission_denied: read_package`).

To update it, run `npm pack --pack-destination <this folder>` in an astro-components checkout of the new tag. Then run `npm install --save file:vendor/<new tarball>` here and delete the old tarball.

To install from GitHub Packages instead, give this repository read access under the package's settings (Manage Actions access). Then switch the dependency back to `^0.2.0`.
