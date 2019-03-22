# include gdrive-sheets

load-spreadsheet("14er5Mh443Lb5SIFxXZHdAnLCuQZaA8O6qtgGlibQuEg")

load-table: nth, name, home-state, year-started, year-ended, party
  source: presidents-sheet.sheet-by-name("presidents", true)
end

x = 3

3 + 5

fun f(x): x + 3 end

f(5)

l = [list: 1, 2, 3]

l.len()

check:
  3 + 5 is 8
end

{1; 2}

row["field"]