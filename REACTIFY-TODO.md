1. We are not using keymap right now. It's not clear if the keymap should work
on the CM background (when cursor is active) or when nodes are focused (though it's super easy to add once we know an answer to this question)

2. Right now we use a lot of global object. This means there can be only one instance of CMB (since the global object would be shared which is a bad thing). However, we can migrate stuff out of the global object in a straightforward way (though pretty tedious)

Some stuff can be in global. E.g., the clipboard buffer. Totally fine to share it.

3. Let's rewrite the annoucement area in the React style

4. In `activateNode`, we completely do nothing (except reading aria-label). Is this OK?

---------

1. clean up focusSelf
2. There's a bug: if we change `(a b)` to `( a b )`, then things become messy.
3. Search 
4. Toolbar
5. Automated testing

----------

