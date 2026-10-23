"""v1.4 黑心公司篇提示詞 → work/prompts/v14_*.txt / .refs
用法: python3 tools/v14_prompts.py   （印出名稱，丟給 tools/run.sh）
"""
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
P = {}
EMBLEM = 'a small cracked black heart emblem with a red glow (the Black Heart Corporation logo)'
GREEN = 'Background: one flat solid pure green color (#00FF00) everywhere, no gradient, no ground shadow, no frame, no text, no letters, no numbers, no green on the character or outline.'
BOSS = ('Match the art style of the reference images exactly. Art style: cute chibi monster enemy for a cheerful mobile idle RPG set in an office, big expressive face, clean bold dark outlines, soft cel shading, vibrant colors, polished gacha-game quality. '
        'The monster faces toward the LEFT side of the image in a 3/4 view (head, body and feet all facing left), in an aggressive but funny pose. Exactly one creature, centered, whole body visible with generous empty margin. '
        'Make it a large imposing BOSS monster, bigger and more detailed, with a glowing red and black aura close around it. It belongs to the evil "Black Heart Corporation": color scheme black, dark red and gold, and it wears ' + EMBLEM + ' somewhere visible. Villainous but cute, not gory, not horror. ')
BOSSES = {
    'b_996': 'Boss "996 Overseer": a giant hulking overseer robot of black steel with red warning lights, angry glowing red LED eyes, a big punch time-clock built into its chest, factory gears on its shoulders, swinging a long whip made of a tangled black network cable, steam puffing from its head.',
    'b_unpaid': 'Boss "Unpaid Leave Demon": a big round GHOST-like shadow demon made of swirling dark purple and black smoke (NO horns, NO fire, NO human body, NO suit), two glowing red eyes and a wide sneaky crescent grin, two long smoky arms hugging a huge blank white wall calendar with every day crossed out, empty calendar pages and an empty upside-down wallet floating around it, its lower body fading into a smoky tail. Its aura is purple smoke instead of fire.',
    'b_duty': 'Boss "Responsibility Colossus": a heavy golem colossus built from thick iron chains, big padlocks and stacked open laptops as armor plates, the laptop screens glowing red, one huge fist wrapped in chains, glowing red eyes in a laptop-shaped head.',
    'b_merger': 'Boss "Merger Octopus": a giant dark crimson octopus wearing a black pinstriped business suit jacket, a red tie and a gold monocle, each of its many tentacles holding a fountain pen, a red company stamp or a contract while signing papers, contract papers flying around it, smug grin.',
    'b_ceo': 'Final Boss "Black Heart Chairman": a giant chubby BLACK CAT (an animal, not a human) standing on two legs, sharp glowing yellow eyes and an evil toothy grin, wearing a tall black top hat with a red band, a black tuxedo with a red tie and gold chain, smoking a fat cigar with curling smoke, a big glowing red cracked black heart shining on its chest, gold rings on its paws, banknotes swirling in a dark red aura.',
}
for k, v in BOSSES.items():
    P['v14_' + k] = (BOSS + v + ' ' + GREEN, ['work/gen/b_report.png', 'work/gen/b_client.png'])
# 無薪假魔：參考圖有紅色惡魔（b_client）會被帶偏，改用幽靈系的 b_final 當參考、另寫提示詞
P['v14_b_unpaid'] = ('Match only the line style and shading of the reference image. Art style: cute chibi monster enemy for a cheerful mobile idle RPG set in an office, clean bold dark outlines, soft cel shading, polished gacha-game quality. '
    'A large BOSS monster facing toward the LEFT side of the image, centered, whole body visible with generous empty margin. '
    'Boss "Unpaid Leave Ghost": a big round floating GHOST made of soft swirling dark purple and indigo smoke, shaped like a big blob with a wispy smoky tail instead of legs. '
    'Its face is just two big glowing red eyes and a wide sneaky crescent grin on the smoke. It has NO horns, NO hair, NO skin, NO clothes, NO hands with claws: only two long wispy smoke arms. '
    'The smoke arms hug a huge white wall calendar with every day crossed out in red. Empty calendar pages and an empty open wallet float around it. A small cracked black heart badge with a red glow floats on its smoky chest. '
    'Its aura is drifting purple smoke and small purple sparkles, no fire, no flames, no red aura. Villainous but cute, not horror. ' + GREEN, ['work/gen/b_final.png'])

MON = ('Match the art style of the reference images exactly. Art style: cute chibi monster enemies for a cheerful mobile idle RPG set in an office, big expressive faces, clean bold dark outlines, soft cel shading, vibrant colors, polished gacha-game quality. '
       'Every monster faces toward the LEFT side of the image in a 3/4 view (head, body and feet all facing left), cute but a little bit evil, mischievous grin. They work for the evil "Black Heart Corporation": accents of black and dark red. ')
M = {
    'timeclock': 'a grumpy old punch time-clock machine monster, a time card sticking out of its slot like a tongue, red glowing clock-face eyes, tiny stubby legs, sweat drops flying around it',
    'unpaid': 'a sneaky black envelope monster sealed with a red wax seal, pointy grin, waving an empty upside-down wallet, a few dull coins falling out',
    'shackle': 'a pair of steel handcuffs monster whose padlock is its face, rattling chain links, a small black briefcase cuffed to one ring',
    'spy': 'a sneaky little black cat spy standing on two legs in a beige trench coat and dark sunglasses, holding a tiny camera, tiptoeing',
    'contract': 'a long unrolled scroll contract monster covered in tiny unreadable fine-print lines, a big red seal stamp as its fist, sly smirk, a fountain pen tucked behind it',
    'cctv': 'a security camera monster with one big glowing red lens eye on a short pole body, little bat-like black wings, a blinking red light',
    'pie': 'a giant fake golden pie monster that is actually a flat painted cardboard cutout propped up by wooden sticks, big fake smile, sparkles that look cheap',
    'suit': 'a living empty black business suit thug with no body inside, only two glowing red eyes in the dark collar, a red tie, brass knuckles on its white gloves',
    'layoff': 'a folded pink paper letter monster flying like a paper bat, a big red X on its front, sharp paper teeth, little paper wings',
}
order = list(M)
POS = ['TOP-LEFT', 'TOP-RIGHT', 'BOTTOM-LEFT', 'BOTTOM-RIGHT']
MREF = ['work/gen/e_revise.png', 'work/gen/e_phone.png']
for s, ids in (('v14_esheet1', order[0:4]), ('v14_esheet2', order[4:8])):
    t = ('A tall portrait image showing FOUR different monsters arranged in a 2x2 layout, one monster per quadrant, each fully separate with wide empty green space between them (no overlapping, nothing crossing the middle of the image), all drawn at the same size with margin. '
         + ' '.join(f'{POS[j]}: {M[i]}.' for j, i in enumerate(ids)) + ' ' + MON + GREEN.replace('the character', 'any monster'))
    P[s] = (t, MREF)
P['v14_e_layoff'] = ('A tall portrait image of exactly one monster, centered, whole body visible with generous empty margin. Monster: ' + M['layoff'] + '. ' + MON + GREEN, MREF)

P['v14_logo'] = ('A game logo emblem icon, centered with generous empty margin: a glossy cracked black heart, split by a jagged crack down the middle that leaks glowing red light, small sharp devil-horn spikes on top, a thin dark red metallic rim, dramatic red glow around it. Polished mobile game UI icon style, thick dark outline, soft cel shading, no text, no letters. ' + GREEN, [])
P['v14_challenge'] = ('A mobile game UI icon, centered with generous empty margin: two crossed golden swords behind a shiny golden trophy cup with a red ribbon and a small star on it, sparkles. Polished cute gacha game icon style, thick dark outline, glossy highlights, no text, no letters, no numbers. ' + GREEN, [])

CHIB = ('Match the art style of the reference images exactly (chibi, big head about 2.5 heads tall, clean bold dark outlines, soft cel shading, polished gacha-game quality). '
        'Exactly one character, full body, standing in a 3/4 view facing toward the LEFT side of the image; head, shoulders, hips and feet all face left, no twisted neck, no looking back. Generous empty margin. ')
P['v14_v_ceo'] = (CHIB + 'Character: the "Black Heart Chairman", a chubby BLACK CAT (an animal, not a human) standing on two legs, sharp yellow eyes, smug calm villain smile, tall black top hat with a red band, black tuxedo with a red tie and a gold watch chain, holding a fat cigar with a thin curl of smoke, a softly glowing red cracked black heart on its chest. Calm and arrogant, not enraged, no aura. ' + GREEN,
                ['work/gen/base2_vivi.png', 'work/gen/base2_jie.png'])
P['v14_v_aide'] = (CHIB + 'Character: the Black Heart Chairman\'s assistant, a slim sleek BLACK CAT (an animal, not a human) standing on two legs, dark sunglasses, a neat black suit with a dark red tie and a small cracked black heart pin, a tiny earpiece, holding a glowing tablet, cool expressionless face. ' + GREEN,
                 ['work/gen/base2_vivi.png', 'work/gen/base2_jie.png'])

BGS = ('Match the art style of the reference image (cute polished anime mobile game 2D background, soft painterly cel shading). Side-view (orthographic, like a 2D side-scrolling game stage) wide 16:9 landscape scene. '
       'The bottom 22% of the image is a flat continuous clean floor where characters will stand, nothing blocking the floor. No people, no characters, no text, no letters, no logos except the cracked black heart emblem where stated. '
       'Mood: the evil "Black Heart Corporation" building, red and black color scheme, but still bright and readable enough that characters standing on the floor are clearly visible. Scene: ')
BG = {
    6: 'a grand intimidating corporate lobby of black marble with red accent lights, a long reception counter, tall black pillars, a giant cracked black heart emblem glowing red on the back wall, red carpet runner, security gates.',
    7: 'a cramped gloomy open-plan office of endless identical dark gray cubicles with stacks of paperwork, old monitors glowing red, a wall clock showing late night, red motivational banners without text, dim red ceiling lights.',
    8: 'a server room with rows of tall black server racks blinking red and orange lights, thick cables hanging, chains and padlocks wrapped around some racks, cold red emergency lighting, metal grating floor.',
    9: 'a huge dark boardroom with a very long polished black conference table and tall red leather chairs, a giant screen showing a red falling chart, stacks of contracts, dark red velvet curtains, cracked black heart emblem on the wall.',
    10: 'the luxurious penthouse chairman office at the top of the skyscraper, huge windows showing a stormy red night city skyline, a giant black and gold desk with a throne-like chair, gold safes and money piles, a glowing red cracked black heart emblem.',
}
for i, v in BG.items():
    P[f'v14_bg{i}'] = (BGS + v, ['work/gen/bg5.png'])

for k, (t, refs) in P.items():
    open(f'work/prompts/{k}.txt', 'w').write(t)
    if refs: open(f'work/prompts/{k}.refs', 'w').write('\n'.join(refs) + '\n')
    elif os.path.exists(f'work/prompts/{k}.refs'): os.remove(f'work/prompts/{k}.refs')
print(' '.join(P))
