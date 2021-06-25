const webpack = require("webpack");

module.exports = {
    mode: 'development',
    // WINDOWS: context: 'C:\\Users\\wrait\\Source\\thirdlogan\\gimme',
    context: '/Users/dis/Source/thirdlogan/gimme',
    entry: {
        background: './background/EventPage.js',
        content: './content/ContentPeeper.js',
        options: './options/Optionator.js',
        popup: './popup/Popup.js',
        base: './base/DataClasses.js'
    },
    output: {
        // WINDOWS: path: 'C:\\Users\\wrait\\Source\\thirdlogan\\gimme',
        path: '/Users/dis/Source/thirdlogan/gimme',
        filename: './[name]/bundle.js',
        publicPath: "./",
        libraryTarget: 'umd',
        globalObject: 'window',
        umdNamedDefine: true
    },
    module: {
        rules:[
            {
                test: /\.js?$/,
                enforce: 'pre',
                use: ['source-map-loader']
            },
            {
                test: /\.js?$/,
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
    devtool: 'source-map',
    target: 'web'
};
