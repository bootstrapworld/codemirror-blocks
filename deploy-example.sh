echo "building static resources"
npm run build
cp -R build/ build-copy
cp example/index.html build-copy/
cp example/wescheme.html build-copy/
cp example/pyret.html build-copy/
echo "switching to gh-pages branch"
git checkout -B gh-pages origin/gh-pages
git pull
rm -rf build
mv build-copy/ build
mv build/index.html example.html
mv build/wescheme.html .
mv build/pyret.html .
git add build/
git add example.html
git add wescheme.html
git add pyret.html
echo "committing changes"
git commit -m "updating example page"
echo "pushing changes to github"
git push
echo "switching back to master"
git checkout master
