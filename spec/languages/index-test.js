import {addLanguage, removeLanguage} from 'codemirror-blocks/languages';

describe('addLanguage function,', function() {
  beforeEach(function() {
    removeLanguage('foo');
    addLanguage({id:'foo', name:'foo', getParser() {return {parse(){}};}});
  });
  afterEach(function() {
    removeLanguage('foo');
    removeLanguage('bar');
  });
  it('should throw an error if the language has already been defined', function() {
    expect(() => addLanguage({id:'foo'}))
      .toThrowError('language foo has already been added.');
  });
  it('should throw an error if the language is missing a name', function() {
    expect(() => addLanguage({id:'bar'}))
      .toThrowError('language definition for bar is missing a \'name\' attribute.');
  });
  it('should throw an error if the language is missing a getParser function', function() {
    expect(() => addLanguage({id:'bar', name:'Bar Language'}))
      .toThrowError('language definition for bar is missing a \'getParser\' function.');
  });
  it('should throw an error if the getParser function does not return a proper obj', function() {
    expect(() => addLanguage({id:'bar', name:'Bar Language', getParser(){}}))
      .toThrowError(
        'getParser() function for language bar must return an object with a \'parse\' function.'
      );
  });
});
