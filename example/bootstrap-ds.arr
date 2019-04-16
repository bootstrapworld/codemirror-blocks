# include gdrive-sheets

x = 3

l = [list: 1, 2, 3]

{1; 2}

# questionable?
row["field"]

fun f(x) block:
  print(x)
  x + 3
end

animals-table = load-table: name, species, gender, age, fixed, legs, pounds, weeks
 source: shelter-sheet.sheet-by-name("pets", true)
end

fun img(animal):
  ask:
    | (animal["species"] == "dog") then: dog-img
    | (animal["species"] == "cat") then: cat-img
    | (animal["species"] == "rabbit") then: rabbit-img
    | (animal["species"] == "tarantula") then: tarantula-img
    | (animal["species"] == "lizard") then: lizard-img
  end
end