module.exports = {
    mode: 'development',
    // WINDOWS: context: 'C:\\Users\\wrait\\Source\\sidspencer\\gimme',
    context: '/Users/dis/Source/sidspencer/gimme',
    entry: {
        background: './background/EventPage.js',
        content: './content/ContentPeeper.js',
        options: './options/options.js',
        popup: './popup/popup.js'
    },
    output: {
        // WINDOWS: path: 'C:\\Users\\wrait\\Source\\sidspencer\\gimme',
        path: '/Users/dis/Source/sidspencer/gimme',
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
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ["@babel/preset-env", {
                            "useBuiltIns": false,
                          }],
                        ],
                        plugins: [
                            '@babel/plugin-transform-classes',
                            ["@babel/plugin-transform-runtime", {
                                "regenerator": true,
                            }],
                        ]
                    }
                }
            }
        ]
    },
    resolve: {
        modules: [ "node_modules", "./" ]
    },
    devtool: "source-map",
    target: "web"
};
