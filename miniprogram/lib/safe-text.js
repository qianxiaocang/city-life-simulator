// Render the result only as text (Canvas fillText / WXML text), never as HTML.
function safeText(value,limit=200){
 if(typeof value!=='string')return '';
 const text=value.normalize('NFC').replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'');
 return Array.from(text).slice(0,limit).join('');
}
module.exports={safeText};
