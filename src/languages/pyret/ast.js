"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const Node_1 = require("../../components/Node");
const P = require("../../pretty");
const ast_1 = require("../../ast");
class Binop extends ast_1.ASTNode {
    constructor(from, to, op, left, right, options = {}) {
        super(from, to, 'binop', ['left', 'right'], options);
        this.op = op;
        this.left = left;
        this.right = right;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a ${this.op} expression with ${this.left.toDescription(level)} and ${this.right.toDescription(level)}`;
    }
    pretty() {
        return P.horzArray([this.left, P.txt(" "), this.op, P.txt(" "), this.right]);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, this.op),
            this.left.reactElement(),
            this.right.reactElement()));
    }
}
exports.Binop = Binop;
class ABlank extends ast_1.ASTNode {
    constructor(from, to, options = {}) {
        super(from, to, 'a-blank', [], options);
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a blank expression`;
    }
    pretty() {
        return P.standardSexpr('Any');
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-literal-symbol" }, "BLANK")));
    }
}
exports.ABlank = ABlank;
class Bind extends ast_1.ASTNode {
    constructor(from, to, id, ann, options = {}) {
        super(from, to, 'bind', ['ann'], options);
        this.id = id;
        this.ann = ann;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a bind expression with ${this.id.value} and ${this.ann}`;
    }
    pretty() {
        console.log(this.id);
        if (this.ann.type != "a-blank")
            return P.txt(this.id.value + " :: " + this.ann);
        else
            return P.txt(this.id.value);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-literal-symbol" }, this.id.value)));
    }
}
exports.Bind = Bind;
class Func extends ast_1.ASTNode {
    constructor(from, to, name, args, retAnn, doc, body, options = {}) {
        super(from, to, 'functionDefinition', ['args', 'retAnn', 'body'], options);
        this.name = name;
        this.args = args;
        this.retAnn = retAnn;
        this.doc = doc;
        this.body = body;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a func expression with ${this.name}, ${this.args} and ${this.body.toDescription(level)}`;
    }
    pretty() {
        return P.horzArray([P.txt("fun "), this.name, P.txt("("), P.horzArray(this.args.map(p => p.pretty())), P.txt(")"), this.body]);
    }
    render(props) {
        let args = this.args[0].reactElement();
        let body = this.body.reactElement();
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, this.name),
            react_1.default.createElement("span", { className: "blocks-args" }, args),
            body));
    }
}
exports.Func = Func;
class Sekwence extends ast_1.ASTNode {
    constructor(from, to, exprs, name, options = {}) {
        super(from, to, 'sekwence', ['exprs'], options);
        this.exprs = exprs;
        this.name = name;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a sequence containing ${this.exprs.toDescription(level)}`;
    }
    pretty() {
        return P.horzArray([P.txt(":"), P.horzArray(this.exprs), P.txt("end")]);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, this.name),
            this.exprs[0].reactElement()));
    }
}
exports.Sekwence = Sekwence;
class Var extends ast_1.ASTNode {
    constructor(from, to, id, rhs, options = {}) {
        super(from, to, 'var', ['id', 'rhs'], options);
        this.id = id;
        this.rhs = rhs;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a var setting ${this.id} to ${this.rhs}`;
    }
    pretty() {
        return P.txt(this.id + " = " + this.rhs);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, "VAR"),
            react_1.default.createElement("span", { className: "block-args" },
                this.id.reactElement(),
                this.rhs.reactElement())));
    }
}
exports.Var = Var;
class Assign extends ast_1.ASTNode {
    constructor(from, to, id, rhs, options = {}) {
        super(from, to, 'assign', ['id', 'rhs'], options);
        this.id = id;
        this.rhs = rhs;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a assign setting ${this.id} to ${this.rhs}`;
    }
    pretty() {
        return P.horzArray([this.id, P.txt(' := '), this.rhs]);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, ":="),
            react_1.default.createElement("span", { className: "block-args" },
                this.id.reactElement(),
                this.rhs.reactElement())));
    }
}
exports.Assign = Assign;
class Let extends ast_1.ASTNode {
    constructor(from, to, id, rhs, options = {}) {
        super(from, to, 'let', ['id', 'rhs'], options);
        this.id = id;
        this.rhs = rhs;
    }
    toDescription(level) {
        if ((this.level - level) >= ast_1.descDepth)
            return this.options['aria-label'];
        return `a let setting ${this.id} to ${this.rhs}`;
    }
    pretty() {
        return P.horzArray([this.id, P.txt('let'), this.rhs]);
    }
    render(props) {
        return (react_1.default.createElement(Node_1.default, Object.assign({ node: this }, props),
            react_1.default.createElement("span", { className: "blocks-operator" }, "LET"),
            react_1.default.createElement("span", { className: "block-args" },
                this.id.reactElement(),
                this.rhs.reactElement())));
    }
}
exports.Let = Let;
//# sourceMappingURL=ast.js.map