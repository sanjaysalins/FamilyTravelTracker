import json
T={"q4":"Tea","q7":"Calmly explains why surgery is needed","q8":"Early clinic tomorrow","q9":"Sleeping in and resting","q10":"Family group chats","q11":"Studious topper","q12":"Still 25 inside!"}
O={"q4":["Tea","Coffee","Both","Neither"],
"q7":["Calmly explains why surgery is needed","Gives the drops, with a warning","Sighs and gives \"that look\"","Tells a story about another patient"],
"q8":["Early clinic tomorrow","Headache","Tired / long day","Just says goodbye and goes"],
"q9":["Sleeping in and resting","Cooking / feeding the family","Shopping or outing","Catching up with friends and phone calls"],
"q10":["Family group chats","Forwards and good-morning messages","Voice notes","Photos and videos"],
"q11":["Studious topper","Naughty prankster","Quiet dreamer","Bossy leader"],
"q12":["Proud and happy","Still 25 inside!","Please don't mention it","Ready to slow down"]}
# text answers: (answer, meant)
G=[
("Basavaraj",["interiar designer","paani puri",  "rishi kapur","Tea","hand sanitiser","ghar","1","1","1","1","1","1"],None),
]
guests=[
("Basavaraj",{"q1":("interiar designar",1),"q2":("pani poori",1),"q3":("Rishi Kapur",1),"q5":("sanitiser",1),"q6":("ghar  (house)",1),"q13":("12 hazaar",1)},[0,0,0,0,0,0,0]),
("Fatima",{"q1":("interior decorater",1),"q2":("golgappe",1),"q3":("Amitabh Bachchan",0),"q5":("lipstick",0),"q6":("makaan",1),"q13":("around 10000",1)},[0,1,0,0,3,1,1]),
("Mallikarjun",{"q1":("Teacher",0),"q2":("panipuri ",1),"q3":("Chintu Kapoor",1),"q5":("hand  sanitizer bottle",1),"q6":("car",0),"q13":("12,000",1)},[0,0,2,0,0,0,1]),
("Lakshmi",{"q1":("INTERIOR DESIGNER",1),"q2":("Gol gappa",1),"q3":("Rishi Kapoor ji",1),"q5":("Sanitizer",1),"q6":("Mane (house)",1),"q13":("barah hazar",1)},[0,0,0,1,0,1,0]),
("Imran",{"q1":("fashion desiner",0),"q2":("biryani",0),"q3":("Rishi Kapoor",1),"q5":("tissue",0),"q6":("flat",0),"q13":("20k",1)},[2,3,1,0,2,0,3]),
("Chaitra",{"q1":("interior designing",1),"q2":("pani-puri",1),"q3":("rishi kappor",1),"q5":("handsanitizer",1),"q6":("house in Bangalore",1),"q13":("12000+",1)},[0,0,1,1,0,1,1]),
("Zainab",{"q1":("chef",0),"q2":("chaat",0),"q3":("Neetu Singh",0),"q5":("sanitaizer",1),"q6":("gold",0),"q13":("pachaas hazaar",1)},[1,0,3,0,1,2,3]),
("Prakash",{"q1":("Interior design",1),"q2":("puri",0),"q3":("Raj Kapoor",0),"q5":("handkerchief",0),"q6":("Ghar",1),"q13":("ten thousand",1)},[0,0,0,2,3,0,0]),
]
out=[]
for n,t,ch in guests:
    a={};m={}
    for k,(v,mt) in t.items():
        a[k]=v;m[k]=bool(mt)
    for i,k in enumerate(["q4","q7","q8","q9","q10","q11","q12"]):
        pass
    # choices ordered q4,q7,q8,q9,q10,q11,q12 indices
    for k,idx in zip(["q4","q7","q8","q9","q10","q11","q12"],ch):
        a[k]=O[k][idx];m[k]=(O[k][idx]==T[k])
    a=dict(sorted(a.items(),key=lambda x:int(x[0][1:])));m={k:m[k] for k in a}
    out.append({"name":n,"answers":a,"meant":m})
json.dump(out,open("q2batch4.json","w"),ensure_ascii=False,indent=1)
