module.exports = function(grunt) {

    var allScripts = ['*.js', 'exchanges/*.js', 'tests/*.js'];

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
            all: allScripts
        },
        jsbeautifier: {
            rewrite: {
                src: allScripts
            },
            verify: {
                src: allScripts,
                options: {
                    mode: "VERIFY_ONLY"
                }
            }
        },
        watch: {
            scripts: {
                files: ['*.js', 'exchanges/*.js', 'tests/*.js'],
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
