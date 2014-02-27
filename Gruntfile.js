module.exports = function(grunt) {

    var scripts = ['*.js', 'exchanges/*.js', 'tests/*.js'];
    var json = ['.jshintrc', 'tests/.jshintrc', 'tests/**.json'];
    var scriptsAndJson = scripts.concat(json);

    grunt.initConfig({
        jasmine_node: {
            options: {
                specNameMatcher: "spec.js", // load only specs containing specNameMatcher
                projectRoot: ".",
                requirejs: false,
                forceExit: true
            },
            all: ['tests/']
        },
        jshint: {
            options: {
                jshintrc: true
            },
            all: scriptsAndJson
        },
        jsbeautifier: {
            rewrite: {
                src: scriptsAndJson
            },
            verify: {
                src: scriptsAndJson,
                options: {
                    mode: "VERIFY_ONLY"
                }
            }
        },
        watch: {
            scripts: {
                files: scriptsAndJson,
                tasks: ['default'],
            }
        }
    });

    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['jsbeautifier:rewrite', 'jshint', 'jasmine_node']);
    grunt.registerTask('test', ['jshint', 'jasmine_node', 'jsbeautifier:verify']);
    grunt.registerTask('beautify', 'jsbeautifier:rewrite');




};
