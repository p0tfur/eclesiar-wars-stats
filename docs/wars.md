https://api.eclesiar.com/wars

Parameters
Parameter Type Description Default Required
event_wars integer Display event wars or normal wars (0 for normal, 1 for event) 0 Optional
extra_details integer Include extra details in the response (0 for no, 1 for yes) 0 Optional
expired integer Show expired wars in the response (0 for no, 1 for yes) 0 Optional
war_id integer The ID of the war to retrieve details for 0 Optional
page integer The page number for pagination 1 Optional

Responses
200 Success
{
"code": 200,
"description": "Success",
"data": [
{
"id": 1,
"attackers": {
"id": 1,
"name": "United States",
"avatar": "https://example.com/avatars/us.png"
},
"defenders": {
"id": 2,
"name": "Portugal",
"avatar": "https://example.com/avatars/pt.png"
},
"region": {
"id": 1,
"name": "Lisbon"
},
"attackers_score": 340000,
"defenders_score": 100000,
"current_round_number": 3,
"current_round_id": 325432,
"flags": {
"is_revolution": 0
}
}
]
}

https://api.eclesiar.com/war/rounds

Parameters
Parameter Type Description Default Required
war_id integer The ID of the war to retrieve hits for - Required
Responses
200 Success

{
"code": 200,
"description": "Success",
"data": [
{
"id": 86653,
"end_date": "2025-07-07 05:42:38",
"attackers_score": 0,
"defenders_score": 0,
"attackers_points": 0,
"defenders_points": 0,
"attackers_hero": null,
"defenders_hero": null
},
{
"id": 86654,
"end_date": "2025-07-07 08:22:38",
"attackers_score": 0,
"defenders_score": 0,
"attackers_points": 0,
"defenders_points": 0,
"attackers_hero": null,
"defenders_hero": null
}
]
}

404 Response

{
"code": 404,
"message": "War not found"
}

https://api.eclesiar.com/war/round/hits

Parameters
Parameter Type Description Default Required
war_round_id integer The ID of the war round to retrieve hits for - Required
page integer The page number for pagination 1 Optional
Responses
200 Success

{
"code": 200,
"description": "Success",
"data": [
{
"id": 1,
"fighter": {
"id": 1,
"type": "account"
},
"damage": 1342,
"side": "ATTACKER",
"item_id": null,
"created_at": "2025-07-01 01:00:00"
},
{
"id": 1,
"fighter": {
"id": 1,
"type": "account"
},
"damage": 1252,
"side": "DEFENDER",
"item_id": null,
"created_at": "2025-07-01 00:01:00"
}
]
}
