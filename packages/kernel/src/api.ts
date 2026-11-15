/**
 * Public entry of the kernel, `@svgframe/kernel` (design §3.10, P5a): the
 * domain abstractions and extension-point interfaces that plugins may use.
 * Re-exports only, one name per statement, each named like its source file.
 * Registries, the installer and the editor itself are not here (see host-api.ts).
 */
export { Shape } from "./model/Shape.js";
export { LeafShape } from "./model/LeafShape.js";
export { ContainerShape } from "./model/ContainerShape.js";
export type { ShapeContainer } from "./model/ShapeContainer.js";
export { SvgDocument } from "./model/SvgDocument.js";
export { CanvasSize } from "./model/CanvasSize.js";
export type { ShapeMemento } from "./model/ShapeMemento.js";
export { TreePosition } from "./model/TreePosition.js";
export { ParamSpec } from "./model/ParamSpec.js";
export type { ShapeType } from "./model/ShapeType.js";
export type { ShapeProvider } from "./model/ShapeProvider.js";
export { StaticShapeProvider } from "./model/StaticShapeProvider.js";
export type { ShapeKit } from "./model/ShapeKit.js";
export type { ShapeCatalog } from "./model/ShapeCatalog.js";
export type { ShapeReader } from "./model/ShapeReader.js";
export type { ElementView } from "./model/ElementView.js";
export { EditorError } from "./model/EditorError.js";
export { NumberFormat } from "./model/NumberFormat.js";
export { IdSyntax } from "./model/IdSyntax.js";
export { GeometryAttribute } from "./model/GeometryAttribute.js";
export type { CoordinateRole } from "./model/CoordinateRole.js";
export { XCoordinate } from "./model/XCoordinate.js";
export { YCoordinate } from "./model/YCoordinate.js";
export { Extent } from "./model/Extent.js";
export type { FileSystem } from "./io/FileSystem.js";
export { SvgImporter } from "./io/SvgImporter.js";
export { SvgSerializer } from "./io/SvgSerializer.js";
export { TreeRenderer } from "./view/TreeRenderer.js";
export { ShapeDetailRenderer } from "./view/ShapeDetailRenderer.js";
export { Command } from "./commands/Command.js";
export { EditCommand } from "./commands/EditCommand.js";
export { QueryCommand } from "./commands/QueryCommand.js";
export { DocumentCommand } from "./commands/DocumentCommand.js";
export { HistoryCommand } from "./commands/HistoryCommand.js";
export type { CommandType } from "./commands/CommandType.js";
export { CommandCategory } from "./commands/CommandCategory.js";
export type { CommandContext } from "./commands/CommandContext.js";
export { CommandResult } from "./commands/CommandResult.js";
export { ArgList } from "./commands/ArgList.js";
export type { History } from "./commands/History.js";
export type { CommandCatalog } from "./commands/CommandCatalog.js";
export type { Plugin } from "./extension/Plugin.js";
export type { PluginClass } from "./extension/PluginClass.js";
export type { PluginContext } from "./extension/PluginContext.js";
export { PluginOptions } from "./extension/PluginOptions.js";
