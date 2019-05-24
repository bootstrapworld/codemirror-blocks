fun f(v :: Array<Number>) block:
  when not(is-array(v)): raise("not an Array") end
  v
end