"""Blender compositor pass on the denoised linear EXRs: fog glow, lens dispersion, AgX look,
then 16-bit PNG.   blender -b --python grade.py -- IN_DIR OUT_DIR [EXPOSURE]
(no Render Layers node -> Blender only composites, no scene render)"""
import bpy, sys, os, glob, re

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
expo = float(argv[2]) if len(argv) > 2 else 0.0
files = sorted(glob.glob(os.path.join(src, "*.exr")))
os.makedirs(dst, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
img0 = bpy.data.images.load(files[0])
w, h = img0.size
scn.render.resolution_x, scn.render.resolution_y = w, h
scn.render.resolution_percentage = 100
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.view_settings.exposure = expo
scn.render.image_settings.file_format = "PNG"
scn.render.image_settings.color_depth = "16"
scn.render.image_settings.compression = 15
scn.render.dither_intensity = 0.0

scn.use_nodes = True
ct = scn.node_tree
for n in list(ct.nodes): ct.nodes.remove(n)
im = ct.nodes.new("CompositorNodeImage")
gl = ct.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "HIGH"
gl.threshold = 1.0; gl.mix = -0.85; gl.size = 8
ld = ct.nodes.new("CompositorNodeLensdist"); ld.use_fit = True
ld.inputs[1].default_value = 0.0; ld.inputs[2].default_value = 0.004
co = ct.nodes.new("CompositorNodeComposite")
ct.links.new(im.outputs["Image"], gl.inputs["Image"])
ct.links.new(gl.outputs["Image"], ld.inputs["Image"])
ct.links.new(ld.outputs["Image"], co.inputs["Image"])

for f in files:
    img = bpy.data.images.load(f, check_existing=True)
    im.image = img
    name = os.path.splitext(os.path.basename(f))[0]
    scn.render.filepath = os.path.join(dst, name + ".png")
    bpy.ops.render.render(write_still=True)
    bpy.data.images.remove(img)
    print("[grade]", name, flush=True)
