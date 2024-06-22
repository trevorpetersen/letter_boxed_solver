import fs from 'node:fs';

import Graph from '@dagrejs/graphlib';
import TrieSearch from 'trie-search';

interface TriNode {
    word: string;
}

interface LetterBoxWord {
    word: string;
    nodeKeys: string[];
}

interface LetterBoxSolution {
    numSeenLetterNodes: number;
    letterBoxWordList: LetterBoxWord[];
}

function getWords(words_file_path: string): Set<string> {
    const wordsContents = fs.readFileSync(words_file_path, 'utf8');
    const words = wordsContents.split('\n')
        .filter(word => /^[a-zA-Z]+$/.test(word))
        .map(word => word.toLowerCase());
    return new Set(words);
}

function createTrie(words: Set<string>): TrieSearch<TriNode> {
    const trie : TrieSearch<TriNode> = new TrieSearch<TriNode>('word');
    words.forEach(word => trie.add({word}));

    return trie;
}

function createLetterBoxGraph(sides: string[][]) : Graph.Graph {
    const graph = new Graph.Graph({directed: false});

    for (let i = 0; i < sides.length; i++) {
        const side1 = sides[i];
        for (let j = i + 1; j < sides.length; j++) {
            const side2 = sides[j];

            for (let letterI = 0; letterI < side1.length; letterI++) {
                const letter1 = side1[letterI];
                const letter1Key = `${i}${letterI}:${letter1}`;
                for (let letterJ = 0; letterJ < side2.length; letterJ++) {
                    const letter2 = side2[letterJ];
                    const letter2Key = `${j}${letterJ}:${letter2}`;

                    graph.setNode(letter1Key, letter1);
                    graph.setNode(letter2Key, letter2);
                    graph.setEdge(letter1Key, letter2Key);
                }
            }
        }
    }

    return graph;
}

function createWordGraph(words: Set<LetterBoxWord>) : Graph.Graph {
    const startMap: Map<string, LetterBoxWord[]> = new Map();
    const endMap: Map<string, LetterBoxWord[]> = new Map();

    for (let word of words) {
        const startCharKey = word.nodeKeys[0];
        const endCharKey = word.nodeKeys[word.nodeKeys.length - 1];

        if(!startMap.has(startCharKey)) {
            startMap.set(startCharKey, []);
        }
        if(!endMap.has(endCharKey)) {
            endMap.set(endCharKey, []);
        }

        startMap.get(startCharKey).push(word);
        endMap.get(endCharKey).push(word);
    }

    const allKeys = new Set(Array.from(startMap.keys()).concat(Array.from(endMap.keys())));

    const graph = new Graph.Graph({directed: true});
    for(let key of allKeys) {
        for (let startWord of startMap.get(key) || []) {
            const startWordKey = startWord.nodeKeys.join('->');
            for (let endWord of endMap.get(key) || []) {
                const endWordKey = endWord.nodeKeys.join('->');

                graph.setNode(startWordKey, startWord);
                graph.setNode(endWordKey, endWord);

                if(startWordKey != endWordKey) {
                    graph.setEdge(endWordKey, startWordKey);
                }
            }
        }
    }

    return graph;
}

function findWords(trie: TrieSearch<TriNode>, graph: Graph.Graph): Set<LetterBoxWord> {
    const words = new Set<LetterBoxWord>();

    for(let node of graph.nodes()) {
        visitNode(node, [], new Set(), graph, trie, words);
    }

    return words;
}

function visitNode(nodeKey: any, path: any[], seenPaths: Set<string>, graph: Graph.Graph, trie: TrieSearch<TriNode> ,words: Set<LetterBoxWord>) {
    path.push(nodeKey);
    const pathKey = path.join(' ');
    const prefix = path.map(pathNodeKey => graph.node(pathNodeKey)).join('');

    if (seenPaths.has(pathKey)) {
        path.pop();
        return;
    }

    seenPaths.add(pathKey);

    if (isWord(prefix, trie)) {
        words.add({
            word: prefix,
            nodeKeys: Array.from(path),
        });
    }

    if (isPrefix(prefix, trie)) {
        for(let neighborKey of graph.neighbors(nodeKey) || []) {
            visitNode(neighborKey, path, seenPaths, graph, trie, words);
        }
    }

    path.pop();
}


function isWord(s: string, trie: TrieSearch<TriNode>): boolean {
    if (s.length < 3) {
        return false;
    }

    const words = trie.search(s);

    return words.length > 0 && words[0].word == s;
}

function isPrefix(prefix: string, trie: TrieSearch<TriNode>): boolean {
    const words = trie.search(prefix);

    return words.length > 0;
}

function findSolutions(wordGraph: Graph.Graph, minNumNodes: number): LetterBoxSolution[] {
    const solutions = [];
    for (const nodeKey of wordGraph.nodes()) {
        exploreWordGraph(nodeKey, [], wordGraph, new Set(), minNumNodes, solutions);
    }

    return solutions;
}

function exploreWordGraph(nodeKey: string, path: any[], graph: Graph.Graph, seenPaths: Set<string>, minNumNodes: number, solutions: LetterBoxSolution[]): void {
    if (path.length > 25) {
        throw Error('too many paths')
    }

    if (!hasNewNode(graph.node(nodeKey), path.map(key => graph.node(key)))) {
        return;
    }

    path.push(nodeKey);

    const pathKey = path.join('');
    if (seenPaths.has(pathKey)) {
        path.pop();
        return;
    } else {
        seenPaths.add(pathKey);
    }

    const words = path.map(pathItem => graph.node(pathItem));
    const seenLetterNodes = new Set(words
        .map(word => word.nodeKeys)
        .flat());

    if (seenLetterNodes.size >= minNumNodes) {
        solutions.push({
            numSeenLetterNodes: seenLetterNodes.size,
            letterBoxWordList: Array.from(words),
        });
    } else {
        for(let neighborKey of graph.successors(nodeKey) || []) {
            exploreWordGraph(neighborKey, path, graph, seenPaths, minNumNodes, solutions);
        }
    }

    path.pop();
}

function hasNewNode(word: LetterBoxWord, seenWords: LetterBoxWord[]): boolean {
    const seenNodes = new Set(seenWords
        .map(word => word.nodeKeys)
        .flat());

    const seenNodesLength = seenNodes.size;

    word.nodeKeys.forEach(key => seenNodes.add(key));

    return seenNodes.size > seenNodesLength;
}

function filterWordsInLetterBox(words: Set<LetterBoxWord>): Set<LetterBoxWord> {
    const wordsArray = Array.from(words);
    const filteredWords = new Set<LetterBoxWord>();

    for(let i = 0; i < wordsArray.length; i++) {
        let addWord = true;
        const word1 = wordsArray[i];
        const word1KeySet = new Set(word1.nodeKeys);

        for(let j = i + 1; j < wordsArray.length; j++) {
            const word2 = wordsArray[j];
            const word2KeySet = new Set(word2.nodeKeys);

            if(new Set([...word1KeySet].filter(x => !word2KeySet.has(x))).size === 0) {
                addWord = false;
                break;
            }
        }

        if (addWord) {
            filteredWords.add(word1);
        }
    }

    return filteredWords;
}

function main() {
    const allWords = getWords('words.txt');
    const trie = createTrie(allWords);
    const graph = createLetterBoxGraph([
        ['e', 'r', 'a'],
        ['l', 'c', 'h'],
        ['y', 'i', 'k'],
        ['t', 'n', 'p'],
    ]);

    const wordsInLetterBox = findWords(trie, graph);
    console.log('Found', wordsInLetterBox.size, 'valid words');
    const filteredWordsInLetterBox = filterWordsInLetterBox(wordsInLetterBox);
    console.log('Filtered down to ', filteredWordsInLetterBox.size, 'optimal words');
    const wordGraph = createWordGraph(filteredWordsInLetterBox);
    const solutions = findSolutions(wordGraph, graph.nodeCount());
    console.log('Found', solutions.length, 'solutions')

    solutions.sort((solutionA, solutionB) => solutionA.letterBoxWordList.length - solutionB.letterBoxWordList.length);

    const numSolutionsToShow = 3;
    console.log('Showing the', numSolutionsToShow, 'best solutions')
    console.log(solutions.slice(0, numSolutionsToShow).map(solution => solution.letterBoxWordList));
}

main();