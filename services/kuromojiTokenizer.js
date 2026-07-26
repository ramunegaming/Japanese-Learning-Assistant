import kuromoji from 'kuromoji';

let tokenizer = null;

export function getTokenizer() {
  return new Promise((resolve, reject) => {
    if (tokenizer) return resolve(tokenizer);
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => {
      if (err) return reject(err);
      tokenizer = t;
      resolve(tokenizer);
    });
  });
}