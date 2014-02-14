module.exports = function(grunt) {

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
            all: ['*.js', 'exchanges/*.js', 'tests/*.js']
        }
    });

    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('default', ['jshint', 'jasmine_node']);



};
