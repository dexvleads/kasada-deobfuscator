const t = require("@babel/types");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const parser = require("@babel/parser");
const fs = require("fs");
const { find_decoder } = require("./src/decoder");

function deobfuscate(input) {
	input = fs.readFileSync(input, "utf8")
	input = input.replace(/1\.toString\(-1\)/g, "");
    const ast = parser.parse(input);
    const state = {
        decoder: find_decoder(ast),
        cleaned_amount: 0,
		decoded_amount: 0,
    };
    
    traverse(ast, {
        CallExpression(path) {
            if (path.node.arguments.length === 2 && t.isNumericLiteral(path.node.arguments[0]) && t.isStringLiteral(path.node.arguments[1])) {
                const { value, raw } = path.node.arguments[0];
                const { value: key } = path.node.arguments[1];
                const decoded = state.decoder(value, key);
                path.replaceWith(t.stringLiteral(decoded));
                state.decoded_amount++;
            }
        }
    });

	traverse(ast, {
		MemberExpression(path) {
			if (path.node.computed && t.isStringLiteral(path.node.property)) {
				const property = path.node.property.value;
				if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(property)) {
					path.node.property = t.identifier(property);
					path.node.computed = false;
					state.cleaned_amount++;
				}
			}
		},

	});

    let deobfuscated = generate(ast, { comments: false }).code;
    console.log(state.decoder)
    console.log(`Replaced ${state.cleaned_amount} identifiers`);
    console.log(`Decoded ${state.decoded_amount} variables`);
    fs.writeFileSync("output.js", deobfuscated);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("args needed");
    process.exit(1);
}

const start = Date.now()
deobfuscate(args[0], args[1]);
const time = Date.now() - start;
console.log(`Took -> ${time} ms`);