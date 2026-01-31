// const readline = require('node:readline').createInterface({
//     input: process.stdin,
//     output: process.stdout,
// });

import nodeExample from "./node"
// import browserExample from "./browser";

nodeExample().then(() => process.exit(0))

// const nodeExampleName = "Node"
// const browserExampleName = "Browser"

// readline.question(`Which example? (${nodeExampleName}, ${browserExampleName}): \n`, (version: string) => {
//     if(version == nodeExampleName) nodeExample()
//     else if(version == browserExampleName) browserExample()
//     else console.log(`Invalid option: ${version}`)

//     readline.close()
// })
