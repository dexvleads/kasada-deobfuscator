const t = require("@babel/types");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const parser = require("@babel/parser");

function create_decoder(array, offset) {
    return function decoder(index, key) {
        const indexx = index - offset;
        var data = array[indexx];
        const args = arguments;
        if (create_decoder.initilized === undefined) {
            function b64decode(encoded) {
                const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
                let decoded = "";
                for (let i = 0, buffer = 0, count = 0; count < encoded.length; count++) {
                    const idx = chars.indexOf(encoded[count]);
                    if (idx === -1) continue;
                    
                    buffer = (i % 4) ? buffer * 64 + idx : idx;
                    if (i++ % 4) {
                        decoded += String.fromCharCode((buffer >> (-2 * i & 6)) & 0xFF);
                    }
                }
                const uri = decoded.split('').map(char => '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)).join('');
                return decodeURIComponent(uri);
            }
            
            function rc4_decrypt(encrypted, key) {
                const sbox = Array.from({length: 256}, (_, i) => i);
                let i = 0, j = 0, temp;
                for (i = 0; i < 256; i++) {
                    j = (j + sbox[i] + key.charCodeAt(i % key.length)) % 256;
                    [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
                }
                
                i = j = 0;
                const decrypted = [];
                const decoded = b64decode(encrypted);
                
                for (let k = 0; k < decoded.length; k++) {
                    i = (i + 1) % 256;
                    j = (j + sbox[i]) % 256;
                    [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
                    
                    const xor_idx = (sbox[i] + sbox[j]) % 256;
                    decrypted.push(String.fromCharCode(decoded.charCodeAt(k) ^ sbox[xor_idx]));
                }
                
                return decrypted.join('');
            }
            
            create_decoder.decryptor = rc4_decrypt;
            create_decoder.initilized = true;
        }
        if (!args[indexx + array[0]]) {
            data = create_decoder.decryptor(data, key);
            args[indexx + array[0]] = data;
        } else {
            data = args[indexx + array[0]];
        }
        return data;
    };
}

function shuffle(code, decoder, offset, array) {
    let ast = parser.parse(code);
    let expected = null;
    let equation = null;
    
    traverse(ast, {
        CallExpression(path) {
            if (path.node.callee.type === "FunctionExpression" && 
                path.node.callee.params.length === 2 &&
                generate(path.node.callee).code.includes("parseInt")) {
                    ast = parser.parse("!" + generate(path.node).code + ";");
                    expected = path.node.arguments[1].value;
                }
        }
    });

    traverse(ast, {
        VariableDeclarator(path) {
            const { id, init } = path.node;
            if (t.isBinaryExpression(init)) {
                path.traverse({
                    CallExpression(path) {
                        if (path.node.callee.name !== 'parseInt') {
                            path.node.callee = t.identifier("decoder");
                        }
                    }
                });
                equation = generate(init).code;
            }
        },
    });
    
    while (true) {
		try {
            decoder = create_decoder(array, offset);
			const result = eval(equation);
			if (expected === result) {
				return decoder;
			}
			array.push(array.shift());
		} catch (e) {
			array.push(array.shift());
		}
	}
}

function find_decoder(ast) {
    let decoder = null;
    let offset = null;
    let array = null;

    traverse(ast, {
        NumericLiteral(path) {
            if (path.node.extra && path.node.extra.raw.startsWith("0x")) {
                path.node.extra.raw = path.node.value.toString(10);
            }
        },
        Identifier(path) {
            const hexMatch = /(.*)0x([0-9a-fA-F]+)/.exec(path.node.name);
            if (hexMatch) {
                const prefix = hexMatch[1];
                const decimalValue = parseInt(hexMatch[2], 16).toString(10);
                path.node.name = `${prefix}${decimalValue}`;
            }
        }
    });

    traverse(ast, {
        FunctionDeclaration(path) {
            const { id } = path.node;
            if (id && id.name && !decoder) {
                path.get("body").traverse({
                    ArrayExpression(inner) {
                        const array_node = inner.node;
                        if (array_node.elements.length > 50 && !decoder) {
                            array = eval(generate(array_node).code);
                        }
                    }
                });
            }
        }
    });

    let look_next = false;
    let decoder_name = null;
    traverse(ast, {
        VariableDeclarator(path) {
            const { id, init } = path.node;
            if (t.isCallExpression(init) && array && !decoder) {
                look_next = true;
            }
        },

        AssignmentExpression(path) {
            const { left } = path.node;
            if (look_next && !decoder) {
                look_next = false;
                path.traverse({
                    BinaryExpression(inner) {
                        if (t.isBinaryExpression(inner.node)) {
                            const { right, operator } = inner.node;
                            if (operator === "-") {
                                offset = right.value;
                                decoder_name = left.name;
                                decoder = create_decoder(array, offset);
                            }
                        }
                    }
                });
            }
        },
    });

    if (decoder) {
        return shuffle(generate(ast).code, decoder, offset, array);
    }
}

module.exports = {find_decoder};
