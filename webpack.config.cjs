const webpack = require("webpack");
const path = require("path");

module.exports = {
    mode: 'development',
    context: path.resolve(__dirname),
    entry: {
        background: './background/EventPage.js',
        content: './content/ContentPeeper.js',
        options: './options/Optionator.js',
        popup: './popup/Popup.js',
        baselibs: './baselibs/DataClasses.js'
    },
    output: {
        path: path.resolve(__dirname),
        filename: './[name]/bundle.js',
        publicPath: "./",
        libraryTarget: 'umd',
        globalObject: 'window',
        umdNamedDefine: true,
        hashFunction: "xxhash64"
    },
    module: {
        rules:[
            {
                test: /\.m?js$/,
                enforce: 'pre',
                use: ['source-map-loader']
            },
            {
                test: /\.m?js$/,
                resolve: {
                    fullySpecified: false
                }
            },
            {
                test: /\.m?js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                            'useBuiltIns': 'entry',
                            'corejs': 3
                          }],
                        ],
                        plugins: [
                            '@babel/plugin-proposal-class-properties',
                            '@babel/plugin-transform-classes',
                            ['@babel/plugin-transform-runtime', {
                                'regenerator': false,
                                'useESModules': true,
                            }],
                            'es6-promise'
                        ]
                    }
                }
            }
        ]
    },
    resolve: {
        modules: [ 'node_modules', './' ]
    },
    devtool: "source-map",
    target: 'web'
};
