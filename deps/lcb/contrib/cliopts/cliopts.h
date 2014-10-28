#ifndef CLIOPTS_H_
#define CLIOPTS_H_

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

#if defined(_WIN32) && defined(CLIOPTS_BUILDING_DLL)
#define CLIOPTS_API __declspec( dllexport )

#else
#define CLIOPTS_API
#endif


/**
 * Various option types
 */
typedef enum {
    /** takes no argument, dest should be anything big enough to hold a boolean*/
    CLIOPTS_ARGT_NONE,

    /** simple int type, dest should be an 'int' */
    CLIOPTS_ARGT_INT,

    /** dest should be an unsigned int */
    CLIOPTS_ARGT_UINT,

    /** dest should be an unsigned int, but command line format is hex */
    CLIOPTS_ARGT_HEX,

    /** dest should be a char**. Note that the string is allocated, so you should
     * free() it when done */
    CLIOPTS_ARGT_STRING,

    /** dest should be a float* */
    CLIOPTS_ARGT_FLOAT
} cliopts_argtype_t;

typedef struct {
    /**
     * Input parameters
     */

    /** Short option, i.e. -v  (0 for none) */
    char kshort;

    /** long option, i.e. --verbose, NULL for none */
    const char *klong;

    /** type of value */
    cliopts_argtype_t ktype;

    /** destination pointer for value */
    void *dest;

    /** help string for this option */
    const char *help;

    /** description of the value, e.g. --file=FILE */
    const char *vdesc;


    /** set this to true if the user must provide this option */
    int required;

    /** set this to true to disable showing the option in the help text */
    int hidden;

    /**
     * Output parameters
     */

    /** whether this option was encountered on the command line */
    int found;

} cliopts_entry;

struct cliopts_extra_settings {
    /** Assume actual arguments start from argv[0], not argv[1] */
    int argv_noskip;
    /** Don't exit on error */
    int error_noexit;
    /** Don't print help on error */
    int error_nohelp;
    /** Don't interpret --help or -? as help flags */
    int help_noflag;
    /** Program name (defaults to argv[0]) */
    const char *progname;
    /** Usage string (defaults to "[OPTIONS..]") */
    const char *argstring;
    /** Short description (empty by default) */
    const char *shortdesc;
    /** Print default values as well */
    int show_defaults;
    /**
     * Maximum length of a line when printing help. This may be detected
     * using the $COLUMNS environment variable
     */
    int line_max;

    /** Positional parameters (if found). If this array is non-NULL on input
     * then parameters which are not recognized will be placed here. Otherwise
     * the parser will return with an error. This array must be large enough
     * to contain `argc` count strings.
     */
    const char **restargs;

    /** Number of positional parameters (if found) */
    unsigned nrestargs;
};

/**
 * Parse options.
 *
 * @param entries an array of cliopts_entry structures. The list should be
 * terminated with a structure which has its dest field set to NULL
 *
 * @param argc the count of arguments
 * @param argv the actual list of arguments
 * @param lastidx populated with the amount of elements from argv actually read
 * @params setting a structure defining extra settings for the argument parser.
 * May be NULL
 *
 * @return 0 for success, -1 on error.
 */
CLIOPTS_API
int
cliopts_parse_options(cliopts_entry *entries,
                      int argc,
                      char **argv,
                      int *lastidx,
                      struct cliopts_extra_settings *settings);
#ifdef __cplusplus
}

#ifdef CLIOPTS_ENABLE_CXX
#include <string>
#include <vector>
#include <list>
#include <cstdlib>
#include <cstring>
#include <cstdio>

namespace cliopts {
class Parser;
class Option : protected cliopts_entry {
public:
    bool passed() const { return found != 0; }
    void setPassed(bool val = true) { found = val ? 1 : 0; }
    int numSpecified() const { return found; }
    Option() { memset(this, 0, sizeof (cliopts_entry)); }
protected:
    union {
        int i;
        unsigned ui;
        const char *s;
        float f;
        void *p;
    } u_value;
    std::string stmp;
private:
    friend class Parser;
};

template <typename T, cliopts_argtype_t Targ>
class TOption : public Option {
public:
    typedef TOption<T,Targ> Ttype;

    TOption(char shortname, const char *longname = NULL, T deflval = T(),
        const char *helpstr = NULL) {
        memset((cliopts_entry *)this, 0, sizeof(cliopts_entry));
        ktype = Targ;
        klong = longname;

        abbrev(shortname);
        description(helpstr);
        setDefault(deflval);
    }

    TOption(const char *longname) {
        memset((cliopts_entry *)this, 0, sizeof(cliopts_entry));
        ktype = Targ;
        klong = longname;
        memset(&u_value, 0, sizeof u_value);
        dest = &u_value;
    }

    TOption(TOption& other) {
        *(cliopts_entry*)this = *(cliopts_entry*) &other;
        stmp = other.stmp;
        u_value = other.u_value;

        dest = &u_value;
        if (other.u_value.s == other.stmp.c_str()) {
            u_value.s = stmp.c_str();
        }

        other.dest = NULL;
    }

    inline Ttype& setDefault(const T& val) {
        u_value.f = val;
        return *this;
    }

    inline Ttype& abbrev(char val) { kshort = val; return *this; }
    inline Ttype& description(const char *msg) { help = msg; return *this; }
    inline Ttype& mandatory(bool val = true) { required = val; return *this; }
    inline Ttype& argdesc(const char *desc) { vdesc = desc; return *this; }
    inline Ttype& hide(bool val = true) { hidden = val; return *this; }

    inline T result() {
        switch (Targ) {
        case CLIOPTS_ARGT_FLOAT:
            return (T) u_value.f;
        case CLIOPTS_ARGT_UINT:
        case CLIOPTS_ARGT_HEX:
            return (T) u_value.ui;
        case CLIOPTS_ARGT_INT:
            return (T) u_value.i;
        default:
            abort();
            return 0;
        }
    }

    // Only used for strings
    inline T& const_result();
    operator T() { return result(); }
};

typedef TOption<std::string, CLIOPTS_ARGT_STRING> StringOption;
typedef TOption<bool, CLIOPTS_ARGT_NONE> BoolOption;
typedef TOption<unsigned, CLIOPTS_ARGT_UINT> UIntOption;
typedef TOption<int, CLIOPTS_ARGT_INT> IntOption;
typedef TOption<int, CLIOPTS_ARGT_HEX> HexOption;
typedef TOption<float, CLIOPTS_ARGT_FLOAT> FloatOption;

template<> inline bool BoolOption::result() {
    return u_value.i != 0;
}

template<> inline std::string& StringOption::const_result() {
    if (u_value.s && passed()) {
        stmp = u_value.s;
    }
    return stmp;
}
template<> inline std::string StringOption::result() {
    return const_result();
}

template<> inline StringOption& StringOption::setDefault(const std::string& s) {
    stmp = s; u_value.s = stmp.c_str(); return *this;
}
template<> inline IntOption& IntOption::setDefault(const int& i) {
    u_value.i = i; return *this;
}
template<> inline HexOption& HexOption::setDefault(const int& i) {
    u_value.i = i; return *this;
}
template<> inline BoolOption& BoolOption::setDefault(const bool& b) {
    u_value.i = b ? 1 : 0; return *this;
}
template<> inline UIntOption& UIntOption::setDefault(const unsigned& ui) {
    u_value.ui = ui; return *this;
}

class Parser {
public:
    Parser(const char *name = NULL) {
        memset(&default_settings, 0, sizeof default_settings);
        default_settings.progname = name;
    }

    void addOption(Option *opt) { options.push_back(opt); }
    void addOption(Option& opt) { options.push_back(&opt); }
    bool parse(int argc, char **argv, bool standalone_args = false) {
        std::vector<cliopts_entry> ents;
        cliopts_extra_settings settings = default_settings;
        int lastix;

        for (unsigned ii = 0; ii < options.size(); ++ii) {
            ents.push_back(*options[ii]);
        }

        if (ents.empty()) { return false; }
        ents.push_back(Option());
        const char **tmpargs = NULL;
        if (standalone_args) {
            tmpargs = new const char*[argc];
            settings.restargs = tmpargs;
            settings.nrestargs = 0;
        }
        settings.show_defaults = 1;

        int rv = cliopts_parse_options(&ents[0], argc, argv, &lastix, &settings);

        if (tmpargs != NULL) {
            for (unsigned ii = 0; ii < settings.nrestargs; ii++) {
                restargs.push_back(tmpargs[ii]);
            }
            delete[] tmpargs;
        }

        // Copy the options back
        for (unsigned ii = 0; ii < options.size(); ii++) {
            *(cliopts_entry *)options[ii] = ents[ii];
        }

        if (rv == 0 && lastix != 0) {
            for (; lastix < argc; lastix++) {
                restargs.push_back(argv[lastix]);
            }
        }

        return rv == 0;
    }

    const std::vector<std::string>& getRestArgs() { return restargs; }
    cliopts_extra_settings default_settings;
private:
    std::vector<Option*> options;
    std::vector<std::string> restargs;
    Parser(Parser&);
};
} // namespace
#endif /* CLIOPTS_ENABLE_CXX */

#endif /* __cplusplus */

#endif /* CLIOPTS_H_ */
